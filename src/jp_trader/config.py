from __future__ import annotations

from pathlib import Path
from typing import Literal, Optional

import yaml
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class RiskConfig(BaseModel):
    max_order_quantity: int = Field(default=100, gt=0)
    max_position_quantity: int = Field(default=1000, gt=0)
    max_notional_yen: float = Field(default=300_000, gt=0)
    max_orders_per_day: int = Field(default=20, gt=0)
    allow_short: bool = False


class EShitenConfig(BaseModel):
    """立花証券 e支店 API (v4r9) 設定."""

    # demo: https://demo-kabuka.e-shiten.jp/e_api_v4r9/
    # prod:  https://kabuka.e-shiten.jp/e_api_v4r9/
    base_url: str = "https://demo-kabuka.e-shiten.jp/e_api_v4r9/"
    json_ofmt: str = "5"
    auth_dir: str = "secrets"
    auth_id_file: str = "e_api_authid.txt"
    private_key_file: str = "e_api_private_key.pem"
    second_password_file: str = "file_pwd2.txt"
    # 公式サンプル互換（任意）: Fernet 暗号化 + API_DECRYPT_KEY
    secure_config_enc: Optional[str] = None
    session_file: str = "secrets/session.json"
    p_no_file: str = "secrets/p_no.json"
    market_code: str = "00"  # 東証
    timeout_sec: float = 15.0


class NotifyConfig(BaseModel):
    macos: bool = True
    webhook_url: Optional[str] = None


class StrategyConfig(BaseModel):
    name: Literal["ma_cross"] = "ma_cross"
    symbol: str = "7203.T"
    quantity: int = Field(default=100, gt=0)
    short_window: int = Field(default=5, gt=1)
    long_window: int = Field(default=25, gt=2)
    poll_interval_sec: float = Field(default=60.0, gt=0.2)

    @field_validator("long_window")
    @classmethod
    def long_gt_short(cls, v: int, info) -> int:
        short = info.data.get("short_window")
        if short is not None and v <= short:
            raise ValueError("long_window は short_window より大きくしてください")
        return v


class AppConfig(BaseModel):
    # alert: 通知のみ / dry_run: APIは叩くが発注しない / paper: 仮想約定
    # live: e支店へ実発注
    mode: Literal["alert", "dry_run", "paper", "live"] = "dry_run"
    broker: Literal["eshiten", "yfinance", "mock"] = "eshiten"
    risk: RiskConfig = Field(default_factory=RiskConfig)
    eshiten: EShitenConfig = Field(default_factory=EShitenConfig)
    notify: NotifyConfig = Field(default_factory=NotifyConfig)
    strategy: StrategyConfig = Field(default_factory=StrategyConfig)
    account: Literal["specific", "general", "nisa"] = "specific"
    log_dir: str = "logs"

    @property
    def is_live(self) -> bool:
        return self.mode == "live"


class EnvSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JP_TRADER_", extra="ignore")

    config_path: Optional[str] = None
    confirm_live: bool = False
    webhook_url: Optional[str] = None
    eshiten_auth_id: Optional[str] = None
    eshiten_second_password: Optional[str] = None
    api_decrypt_key: Optional[str] = None  # Fernet key (also accepts API_DECRYPT_KEY)


def load_config(path: str | Path | None = None) -> AppConfig:
    settings = EnvSettings()
    # Official sample uses API_DECRYPT_KEY without prefix
    import os

    if not settings.api_decrypt_key:
        settings.api_decrypt_key = os.environ.get("API_DECRYPT_KEY")

    config_path = Path(path or settings.config_path or "config.yaml")
    if config_path.exists():
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        cfg = AppConfig.model_validate(raw)
    else:
        cfg = AppConfig()

    if settings.webhook_url:
        cfg.notify.webhook_url = settings.webhook_url
    return cfg


def dump_example_config(path: str | Path) -> None:
    example = AppConfig()
    Path(path).write_text(
        yaml.safe_dump(
            example.model_dump(),
            allow_unicode=True,
            sort_keys=False,
            default_flow_style=False,
        ),
        encoding="utf-8",
    )
