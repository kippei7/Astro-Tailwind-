from __future__ import annotations

import base64
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo

from jp_trader.config import EShitenConfig
from jp_trader.models import normalize_issue_code

logger = logging.getLogger(__name__)


class EShitenError(RuntimeError):
    pass


def p_sd_date() -> str:
    now = datetime.now(ZoneInfo("Asia/Tokyo"))
    return now.strftime("%Y.%m.%d-%H:%M:%S.") + f"{now.microsecond:06d}"[:3]


def urlencode_password(password: str) -> str:
    return urllib.parse.quote(password, safe="")


@dataclass
class EShitenSession:
    auth_id: str
    raw: dict[str, Any]
    base_url: str
    json_ofmt: str
    p_no: int = 1

    @property
    def url_request(self) -> str:
        return str(self.raw["sUrlRequest"])

    @property
    def url_price(self) -> str:
        return str(self.raw["sUrlPrice"])

    @property
    def url_master(self) -> str:
        return str(self.raw["sUrlMaster"])

    def next_p_no(self) -> int:
        self.p_no += 1
        return self.p_no


@dataclass
class EShitenClient:
    config: EShitenConfig
    session: Optional[EShitenSession] = None
    _second_password: str = ""
    _private_key: Any = field(default=None, repr=False)

    def load_credentials(self) -> tuple[str, Any, str]:
        """auth_id, RSA private key, second password を読み込む."""
        # 1) Fernet secure_config.enc（公式サンプル互換）
        enc_path = self.config.secure_config_enc
        decrypt_key = os.environ.get("API_DECRYPT_KEY") or os.environ.get(
            "JP_TRADER_API_DECRYPT_KEY"
        )
        if enc_path and Path(enc_path).exists() and decrypt_key:
            from cryptography.fernet import Fernet
            from Cryptodome.PublicKey import RSA

            blob = Path(enc_path).read_bytes()
            plain = Fernet(decrypt_key.encode()).decrypt(blob)
            cfg = json.loads(plain.decode("utf-8"))
            auth_id = str(cfg["auth_id"]).strip()
            private_key = RSA.import_key(cfg["private_key"])
        else:
            from Cryptodome.PublicKey import RSA

            auth_dir = Path(self.config.auth_dir)
            auth_id = os.environ.get("JP_TRADER_ESHITEN_AUTH_ID")
            if not auth_id:
                auth_file = auth_dir / self.config.auth_id_file
                if not auth_file.exists():
                    raise EShitenError(
                        f"認証IDがありません: {auth_file} または JP_TRADER_ESHITEN_AUTH_ID"
                    )
                auth_id = auth_file.read_text(encoding="utf-8-sig").strip()
            key_file = auth_dir / self.config.private_key_file
            if not key_file.exists():
                raise EShitenError(f"秘密鍵がありません: {key_file}")
            private_key = RSA.import_key(key_file.read_bytes())

        second = os.environ.get("JP_TRADER_ESHITEN_SECOND_PASSWORD", "")
        if not second:
            pwd_file = Path(self.config.auth_dir) / self.config.second_password_file
            if pwd_file.exists():
                second = pwd_file.read_text(encoding="utf-8-sig").strip()
        self._second_password = second
        self._private_key = private_key
        return auth_id, private_key, second

    def _request(self, url: str, *, method: str = "POST") -> dict[str, Any]:
        logger.debug("eshiten request %s", url[:120])
        req = urllib.request.Request(url, method=method)
        try:
            with urllib.request.urlopen(req, timeout=self.config.timeout_sec) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("shift-jis", errors="ignore")
            raise EShitenError(f"HTTP {exc.code}: {body}") from exc
        except urllib.error.URLError as exc:
            raise EShitenError(f"接続失敗: {exc}") from exc

        text = raw.decode("shift-jis", errors="ignore")
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise EShitenError(f"JSON解析失敗: {text[:200]}") from exc

    def _build_url(self, base: str, payload: dict[str, Any], *, auth: bool = False) -> str:
        target = urllib.parse.urljoin(base, "auth/") if auth else base
        # 公式仕様: JSON をクエリ文字列として付与（indent付き可読形式）
        param = json.dumps(payload, indent=4, ensure_ascii=False)
        return f"{target}?{param}"

    @staticmethod
    def _decrypt_url(encoded: str, private_key: Any) -> str:
        from Cryptodome.Cipher import PKCS1_OAEP
        from Cryptodome.Hash import SHA256

        decryptor = PKCS1_OAEP.new(private_key, hashAlgo=SHA256)
        clean = encoded.strip().replace('"', "")
        decrypted = decryptor.decrypt(base64.b64decode(clean))
        return decrypted.decode("utf-8-sig").strip()

    def login(self, *, force: bool = False) -> EShitenSession:
        session_path = Path(self.config.session_file)
        if not force and session_path.exists():
            data = json.loads(session_path.read_text(encoding="utf-8"))
            p_no = 1
            p_no_path = Path(self.config.p_no_file)
            if p_no_path.exists():
                p_no = int(json.loads(p_no_path.read_text(encoding="utf-8")).get("p_no", 1))
            self.session = EShitenSession(
                auth_id=data.get("auth_id", ""),
                raw=data["response"],
                base_url=self.config.base_url,
                json_ofmt=self.config.json_ofmt,
                p_no=p_no,
            )
            # credentials still needed for orders
            self.load_credentials()
            logger.info("既存セッションを読み込みました: %s", session_path)
            return self.session

        auth_id, private_key, _ = self.load_credentials()
        payload = {
            "p_no": "1",
            "p_sd_date": p_sd_date(),
            "sCLMID": "CLMAuthLoginRequest",
            "sAuthId": auth_id,
            "sJsonOfmt": self.config.json_ofmt,
        }
        url = self._build_url(self.config.base_url, payload, auth=True)
        resp = self._request(url)
        if int(resp.get("p_errno", -1)) != 0 or int(resp.get("sResultCode", -1)) != 0:
            raise EShitenError(
                f"ログイン失敗 p_errno={resp.get('p_errno')} "
                f"sResultCode={resp.get('sResultCode')} {resp.get('sResultText')}"
            )
        if not resp.get("sUrlRequest"):
            raise EShitenError(
                "仮想URLが空です。契約締結前書面の未読の可能性があります。"
                "標準Webで書面確認後に再ログインしてください。"
            )

        for key in (
            "sUrlRequest",
            "sUrlMaster",
            "sUrlPrice",
            "sUrlEvent",
            "sUrlEventWebSocket",
        ):
            if resp.get(key):
                resp[key] = self._decrypt_url(str(resp[key]), private_key)

        session_path.parent.mkdir(parents=True, exist_ok=True)
        session_path.write_text(
            json.dumps({"auth_id": auth_id, "response": resp}, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        os.chmod(session_path, 0o600)
        self._save_p_no(1)
        self.session = EShitenSession(
            auth_id=auth_id,
            raw=resp,
            base_url=self.config.base_url,
            json_ofmt=self.config.json_ofmt,
            p_no=1,
        )
        logger.info("ログイン成功。セッションを保存: %s", session_path)
        return self.session

    def _save_p_no(self, p_no: int) -> None:
        path = Path(self.config.p_no_file)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"p_no": str(p_no)}, indent=2), encoding="utf-8")
        os.chmod(path, 0o600)

    def ensure_session(self) -> EShitenSession:
        if self.session is None:
            return self.login(force=False)
        return self.session

    def call_request(self, body: dict[str, Any]) -> dict[str, Any]:
        session = self.ensure_session()
        p_no = session.next_p_no()
        self._save_p_no(p_no)
        payload = {
            "p_no": str(p_no),
            "p_sd_date": p_sd_date(),
            "sJsonOfmt": self.config.json_ofmt,
            **body,
        }
        url = self._build_url(session.url_request, payload, auth=False)
        resp = self._request(url)
        if str(resp.get("p_errno")) == "2":
            logger.warning("仮想URL無効。再ログインします")
            self.login(force=True)
            return self.call_request(body)
        return resp

    def call_price(self, body: dict[str, Any]) -> dict[str, Any]:
        session = self.ensure_session()
        p_no = session.next_p_no()
        self._save_p_no(p_no)
        payload = {
            "p_no": str(p_no),
            "p_sd_date": p_sd_date(),
            "sJsonOfmt": self.config.json_ofmt,
            **body,
        }
        url = self._build_url(session.url_price, payload, auth=False)
        return self._request(url)

    def get_market_price(self, symbol: str) -> float:
        code = normalize_issue_code(symbol)
        resp = self.call_price(
            {
                "sCLMID": "CLMMfdsGetMarketPrice",
                "sTargetIssueCode": code,
                "sTargetColumn": "pDPP,tDPP:T,pPRP",
            }
        )
        rows = resp.get("aCLMMfdsMarketPrice") or []
        if not rows:
            raise EShitenError(f"時価が空です: {symbol} / {resp}")
        price = rows[0].get("pDPP")
        if price in (None, "", "-"):
            # 前日終値フォールバック
            price = rows[0].get("pPRP")
        if price in (None, "", "-"):
            raise EShitenError(f"現在値を取得できません: {symbol}")
        return float(price)

    def list_positions(self, symbol: str | None = None) -> list[dict[str, Any]]:
        code = normalize_issue_code(symbol) if symbol else ""
        resp = self.call_request({"sCLMID": "CLMGenbutuKabuList", "sIssueCode": code})
        if int(resp.get("sResultCode", -1)) != 0:
            raise EShitenError(f"保有照会失敗: {resp.get('sResultText')}")
        # 応答は銘柄リスト形式（環境によりキーが異なるため柔軟に）
        rows = resp.get("aCLMGenbutuKabuList") or resp.get("aGenbutuKabuList") or []
        if not rows and resp.get("sIssueCode"):
            rows = [resp]
        return rows if isinstance(rows, list) else []

    def _tax_code(self, account: str) -> str:
        session = self.ensure_session()
        if account == "nisa":
            return "5"
        if account == "general":
            return "3"
        # specific: ログイン属性から
        tokutei = session.raw.get("sTokuteiKouzaKubunGenbutu", "2")
        return "3" if tokutei == "0" else "1"

    def place_cash_order(
        self,
        *,
        symbol: str,
        side: str,
        quantity: int,
        order_price: str,
        account: str = "specific",
    ) -> dict[str, Any]:
        if not self._second_password:
            self.load_credentials()
        if not self._second_password:
            raise EShitenError(
                "第二パスワードが未設定です（secrets/file_pwd2.txt または "
                "JP_TRADER_ESHITEN_SECOND_PASSWORD）"
            )
        baibai = "3" if side == "buy" else "1"
        payload = {
            "sCLMID": "CLMKabuNewOrder",
            "sZyoutoekiKazeiC": self._tax_code(account),
            "sIssueCode": normalize_issue_code(symbol),
            "sSizyouC": self.config.market_code,
            "sBaibaiKubun": baibai,
            "sCondition": "0",
            "sOrderPrice": order_price,
            "sOrderSuryou": str(quantity),
            "sGenkinShinyouKubun": "0",
            "sOrderExpireDay": "0",
            "sGyakusasiOrderType": "0",
            "sGyakusasiZyouken": "0",
            "sGyakusasiPrice": "*",
            "sTatebiType": "*",
            "sTategyokuZyoutoekiKazeiC": "*",
            "sSecondPassword": urlencode_password(self._second_password),
        }
        resp = self.call_request(payload)
        return resp

    def logout(self) -> None:
        if self.session is None:
            return
        try:
            self.call_request({"sCLMID": "CLMAuthLogoutRequest"})
        except EShitenError as exc:
            logger.warning("ログアウト失敗: %s", exc)
        self.session = None
