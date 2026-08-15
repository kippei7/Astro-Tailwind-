from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Side(str, Enum):
    SELL = "sell"
    BUY = "buy"

    def eshiten_code(self) -> str:
        return "1" if self is Side.SELL else "3"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class AccountType(str, Enum):
    SPECIFIC = "specific"
    GENERAL = "general"
    NISA = "nisa"


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
    note: str = ""

    def validate_for_submit(self) -> None:
        if self.order_type is OrderType.LIMIT and self.limit_price is None:
            raise ValueError("指値注文には limit_price が必要です")
        if self.order_type is OrderType.MARKET and self.limit_price is not None:
            raise ValueError("成行注文に limit_price は指定できません")

    def issue_code(self) -> str:
        return normalize_issue_code(self.symbol)


class OrderResult(BaseModel):
    request: OrderRequest
    status: OrderStatus
    broker_message: str = ""
    filled_price: Optional[float] = None
    submitted_at: datetime = Field(default_factory=datetime.now)
    broker_order_id: Optional[str] = None
    business_day: Optional[str] = None


class Position(BaseModel):
    symbol: str
    quantity: int
    average_price: float


class Signal(str, Enum):
    HOLD = "hold"
    BUY = "buy"
    SELL = "sell"


class Bar(BaseModel):
    symbol: str
    price: float
    timestamp: datetime = Field(default_factory=datetime.now)


def normalize_issue_code(symbol: str) -> str:
    """7203.T / 7203 -> 7203"""
    s = symbol.strip().upper()
    if "." in s:
        s = s.split(".", 1)[0]
    return s
