from __future__ import annotations

import math
from datetime import datetime
from typing import Iterable, Optional

from jp_trader.brokers import Broker
from jp_trader.models import (
    OrderRequest,
    OrderResult,
    OrderStatus,
    Position,
    Quote,
    Side,
)


class YFinanceBroker(Broker):
    """価格参照 + paper 用。実発注はしない."""

    name = "yfinance"

    def __init__(self, *, dry_run: bool = True) -> None:
        import yfinance  # noqa: F401

        self.dry_run = dry_run
        self._positions: dict[str, Position] = {}
        self._seq = 1

    def get_quote(self, symbol: str) -> Quote:
        import yfinance as yf

        ticker = yf.Ticker(symbol)
        price = None
        try:
            fast = ticker.fast_info
            raw = fast.get("last_price") if hasattr(fast, "get") else getattr(fast, "last_price", None)
            if raw is not None:
                price = float(raw)
        except Exception:
            price = None
        if price is None or math.isnan(price):
            hist = ticker.history(period="5d", interval="1d")
            if hist.empty:
                raise RuntimeError(f"yfinance 価格取得失敗: {symbol}")
            price = float(hist["Close"].iloc[-1])
        return Quote(symbol=symbol, price=round(float(price), 2), timestamp=datetime.now())

    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        return [self.get_quote(s) for s in symbols]

    def place_order(self, order: OrderRequest) -> OrderResult:
        order.validate_for_submit()
        fill = order.limit_price or self.get_quote(order.symbol).price
        oid = str(self._seq)
        self._seq += 1
        if self.dry_run:
            return OrderResult(
                request=order,
                status=OrderStatus.DRY_RUN,
                broker_message="yfinance dry_run",
                filled_price=fill,
                broker_order_id=oid,
            )
        self._apply(order, fill)
        return OrderResult(
            request=order,
            status=OrderStatus.FILLED,
            broker_message="yfinance paper fill",
            filled_price=fill,
            broker_order_id=oid,
        )

    def _apply(self, order: OrderRequest, fill: float) -> None:
        pos = self._positions.get(order.symbol)
        if order.side is Side.BUY:
            if pos is None:
                self._positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=order.quantity, average_price=fill
                )
            else:
                total = pos.quantity + order.quantity
                avg = (pos.average_price * pos.quantity + fill * order.quantity) / total
                self._positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=total, average_price=avg
                )
        else:
            if pos is None or pos.quantity < order.quantity:
                raise ValueError("売数量超過")
            remain = pos.quantity - order.quantity
            if remain == 0:
                del self._positions[order.symbol]
            else:
                self._positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=remain, average_price=pos.average_price
                )

    def get_position(self, symbol: str) -> Optional[Position]:
        return self._positions.get(symbol)

    def list_positions(self) -> list[Position]:
        return list(self._positions.values())
