from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Side(str, Enum):
    SELL = "sell"
    BUY = "buy"

    def rss_code(self) -> str:
        # MarketSpeed II RSS: 1=売, 3=買
        return "1" if self is Side.SELL else "3"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"

    def rss_price_kbn(self) -> str:
        # 0=成行, 1=指値
        return "0" if self is OrderType.MARKET else "1"


class AccountType(str, Enum):
    SPECIFIC = "specific"  # 特定
    GENERAL = "general"  # 一般
    NISA_GROWTH = "nisa_growth"
    NISA_TSUMITATE = "nisa_tsumitate"

    def rss_code(self) -> str:
        mapping = {
            AccountType.SPECIFIC: "0",
            AccountType.GENERAL: "1",
            AccountType.NISA_GROWTH: "2",
            AccountType.NISA_TSUMITATE: "3",
        }
        return mapping[self]


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"
    DRY_RUN = "dry_run"


class Quote(BaseModel):
    symbol: str
    price: float
    bid: Optional[float] = None
    ask: Optional[float] = None
    volume: Optional[float] = None
    timestamp: datetime = Field(default_factory=datetime.now)


class OrderRequest(BaseModel):
    symbol: str
    side: Side
    quantity: int = Field(gt=0)
    order_type: OrderType = OrderType.MARKET
    limit_price: Optional[float] = Field(default=None, gt=0)
    account: AccountType = AccountType.SPECIFIC
    # RSS 用ユニーク発注ID。未指定ならブローカー側で採番
    order_id: Optional[int] = Field(default=None, ge=1)
    note: str = ""

    def validate_for_submit(self) -> None:
        if self.order_type is OrderType.LIMIT and self.limit_price is None:
            raise ValueError("指値注文には limit_price が必要です")
        if self.order_type is OrderType.MARKET and self.limit_price is not None:
            raise ValueError("成行注文に limit_price は指定できません")


class OrderResult(BaseModel):
    request: OrderRequest
    status: OrderStatus
    broker_message: str = ""
    filled_price: Optional[float] = None
    submitted_at: datetime = Field(default_factory=datetime.now)
    rss_order_id: Optional[int] = None


class Position(BaseModel):
    symbol: str
    quantity: int
    average_price: float

    @property
    def market_value(self) -> float:
        return self.quantity * self.average_price


class Signal(str, Enum):
    HOLD = "hold"
    BUY = "buy"
    SELL = "sell"


class Bar(BaseModel):
    symbol: str
    price: float
    timestamp: datetime = Field(default_factory=datetime.now)
