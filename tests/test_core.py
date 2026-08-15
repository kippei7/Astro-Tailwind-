from __future__ import annotations

import base64
from pathlib import Path
from unittest.mock import patch

import pytest
from Cryptodome.Cipher import PKCS1_OAEP
from Cryptodome.Hash import SHA256
from Cryptodome.PublicKey import RSA

from jp_trader.config import AppConfig, EShitenConfig, RiskConfig
from jp_trader.engine import LiveModeNotConfirmed, TradingEngine, ensure_live_allowed
from jp_trader.eshiten_client import EShitenClient, p_sd_date
from jp_trader.models import (
    AccountType,
    Bar,
    OrderRequest,
    OrderType,
    Side,
    Signal,
    normalize_issue_code,
)
from jp_trader.risk import RiskGuard, RiskViolation
from jp_trader.strategies.ma_cross import MovingAverageCrossStrategy


def test_normalize_issue_code():
    assert normalize_issue_code("7203.T") == "7203"
    assert normalize_issue_code("7203") == "7203"


def test_ma_cross_buy_signal():
    s = MovingAverageCrossStrategy(short_window=2, long_window=4)
    prices = [10, 9, 8, 7, 8, 12, 14]
    signals = [s.on_bar(Bar(symbol="X", price=p)) for p in prices]
    assert Signal.BUY in signals


def test_risk_blocks_notional():
    guard = RiskGuard(RiskConfig(max_notional_yen=50_000, max_order_quantity=1000))
    order = OrderRequest(
        symbol="7203.T",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.MARKET,
        account=AccountType.SPECIFIC,
    )
    with pytest.raises(RiskViolation):
        guard.check_order(order, last_price=1000, position=None)


def test_live_requires_confirm():
    cfg = AppConfig(mode="live", broker="eshiten")
    with pytest.raises(LiveModeNotConfirmed):
        ensure_live_allowed(cfg)


def test_alert_mode_no_orders():
    cfg = AppConfig(mode="alert", broker="mock")
    engine = TradingEngine.from_config(cfg)

    class N:
        def notify(self, title: str, body: str) -> None:
            pass

    engine.notifier = N()  # type: ignore[assignment]
    assert engine.execute_signal(Signal.BUY, 1000.0) is None
    assert engine.results == []


def test_p_sd_date_format():
    s = p_sd_date()
    assert s[4] == "." and "-" in s


def test_eshiten_login_decrypt_and_session(tmp_path: Path):
    key = RSA.generate(2048)
    pem = key.export_key()
    auth_dir = tmp_path / "secrets"
    auth_dir.mkdir()
    (auth_dir / "e_api_authid.txt").write_text("AUTHID123", encoding="utf-8")
    (auth_dir / "e_api_private_key.pem").write_bytes(pem)
    (auth_dir / "file_pwd2.txt").write_text("pass", encoding="utf-8")

    def enc(url: str) -> str:
        cipher = PKCS1_OAEP.new(key, hashAlgo=SHA256)
        return base64.b64encode(cipher.encrypt(url.encode("utf-8"))).decode()

    login_resp = {
        "p_errno": "0",
        "sResultCode": "0",
        "sTokuteiKouzaKubunGenbutu": "2",
        "sUrlRequest": enc("https://example.test/request/"),
        "sUrlMaster": enc("https://example.test/master/"),
        "sUrlPrice": enc("https://example.test/price/"),
        "sUrlEvent": enc("https://example.test/event/"),
        "sUrlEventWebSocket": enc("wss://example.test/ws"),
    }

    cfg = EShitenConfig(
        base_url="https://demo.example/e_api_v4r9/",
        auth_dir=str(auth_dir),
        session_file=str(auth_dir / "session.json"),
        p_no_file=str(auth_dir / "p_no.json"),
    )
    client = EShitenClient(cfg)

    with patch.object(client, "_request", return_value=login_resp):
        session = client.login(force=True)

    assert session.url_request == "https://example.test/request/"
    assert Path(cfg.session_file).exists()

    client2 = EShitenClient(cfg)
    session2 = client2.login(force=False)
    assert session2.url_price == "https://example.test/price/"


def test_eshiten_place_order_dry_run_path(tmp_path: Path):
    from jp_trader.brokers.eshiten import EShitenBroker

    cfg = EShitenConfig(auth_dir=str(tmp_path))
    broker = EShitenBroker(cfg, dry_run=True)
    order = OrderRequest(
        symbol="7203.T",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.MARKET,
        account=AccountType.SPECIFIC,
    )
    result = broker.place_order(order)
    assert result.status.value == "dry_run"


def test_build_order_url_contains_json():
    cfg = EShitenConfig()
    client = EShitenClient(cfg)
    url = client._build_url(
        "https://example/auth_base/",
        {"sCLMID": "CLMAuthLoginRequest", "sAuthId": "x"},
        auth=True,
    )
    assert "auth/" in url
    assert "CLMAuthLoginRequest" in url
