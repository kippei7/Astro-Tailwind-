from __future__ import annotations

import itertools
import random
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


class MockBroker(Broker):
    name = "mock"

    def __init__(self, *, dry_run: bool = True, seed_prices: dict[str, float] | None = None):
        self.dry_run = dry_run
        self._prices = dict(seed_prices or {"7203.T": 2800.0, "6758.T": 13000.0})
        self._positions: dict[str, Position] = {}
        self._order_seq = itertools.count(1)
        self._history: list[OrderResult] = []

    def seed(self, symbol: str, price: float) -> None:
        self._prices[symbol] = price

    def get_quote(self, symbol: str) -> Quote:
        price = self._prices.get(symbol, 1000.0)
        price = max(1.0, price * (1.0 + random.uniform(-0.001, 0.001)))
        self._prices[symbol] = price
        return Quote(symbol=symbol, price=round(price, 1), timestamp=datetime.now())

    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        return [self.get_quote(s) for s in symbols]

    def place_order(self, order: OrderRequest) -> OrderResult:
        order.validate_for_submit()
        quote = self.get_quote(order.symbol)
        fill = order.limit_price or quote.price
        oid = str(next(self._order_seq))
        if self.dry_run:
            result = OrderResult(
                request=order,
                status=OrderStatus.DRY_RUN,
                broker_message="dry_run",
                filled_price=fill,
                broker_order_id=oid,
            )
            self._history.append(result)
            return result
        self._apply_fill(order, fill)
        result = OrderResult(
            request=order,
            status=OrderStatus.FILLED,
            broker_message="mock filled",
            filled_price=fill,
            broker_order_id=oid,
        )
        self._history.append(result)
        return result

    def _apply_fill(self, order: OrderRequest, fill: float) -> None:
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
