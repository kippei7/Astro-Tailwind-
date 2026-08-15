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


class RssConfig(BaseModel):
    """Windows + MarketSpeed II RSS 用（Mac では未使用）."""

    workbook_path: str = "excel/rss_bridge.xlsm"
    quote_sheet: str = "Quotes"
    symbol_column: str = "A"
    price_column: str = "B"
    data_start_row: int = 2
    vba_stock_order: str = "PyStockOrder"
    vba_next_order_id: str = "PyNextOrderId"
    visible_excel: bool = True


class NotifyConfig(BaseModel):
    macos: bool = True
    webhook_url: Optional[str] = None


class StrategyConfig(BaseModel):
    name: Literal["ma_cross", "manual"] = "ma_cross"
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
    # alert: シグナルを通知のみ（Mac推奨）
    # dry_run: 注文オブジェクトは作るが発注しない
    # paper: yfinance/mock で仮想約定
    # live: Windows RSS 実発注のみ
    mode: Literal["alert", "dry_run", "paper", "live"] = "alert"
    # yfinance: Mac向け実価格 / mock: オフライン / rss: Windowsのみ
    broker: Literal["yfinance", "mock", "rss"] = "yfinance"
    risk: RiskConfig = Field(default_factory=RiskConfig)
    rss: RssConfig = Field(default_factory=RssConfig)
    notify: NotifyConfig = Field(default_factory=NotifyConfig)
    strategy: StrategyConfig = Field(default_factory=StrategyConfig)
    account: Literal["specific", "general", "nisa_growth", "nisa_tsumitate"] = "specific"
    log_dir: str = "logs"

    @property
    def is_live(self) -> bool:
        return self.mode == "live"


class EnvSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="RAKUTEN_TRADER_", extra="ignore")

    config_path: Optional[str] = None
    confirm_live: bool = False
    webhook_url: Optional[str] = None


def load_config(path: str | Path | None = None) -> AppConfig:
    settings = EnvSettings()
    config_path = Path(path or settings.config_path or "config.yaml")
    if not config_path.exists():
        cfg = AppConfig()
    else:
        raw = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        cfg = AppConfig.model_validate(raw)
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
