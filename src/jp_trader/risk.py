from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date

from jp_trader.config import RiskConfig
from jp_trader.models import OrderRequest, Position, Side


class RiskViolation(Exception):
    pass


@dataclass
class RiskGuard:
    config: RiskConfig
    orders_today: int = 0
    _day: date = field(default_factory=date.today)

    def _roll_day(self) -> None:
        today = date.today()
        if today != self._day:
            self._day = today
            self.orders_today = 0

    def check_order(
        self,
        order: OrderRequest,
        *,
        last_price: float | None,
        position: Position | None,
    ) -> None:
        self._roll_day()
        if order.quantity > self.config.max_order_quantity:
            raise RiskViolation(
                f"1注文数量上限超過: {order.quantity} > {self.config.max_order_quantity}"
            )
        if self.orders_today >= self.config.max_orders_per_day:
            raise RiskViolation(
                f"1日注文回数上限超過: {self.orders_today} >= {self.config.max_orders_per_day}"
            )
        price = order.limit_price if order.limit_price is not None else last_price
        if price is not None:
            notional = price * order.quantity
            if notional > self.config.max_notional_yen:
                raise RiskViolation(
                    f"想定約定金額上限超過: {notional:.0f} > {self.config.max_notional_yen:.0f}"
                )
        current_qty = position.quantity if position else 0
        if order.side is Side.BUY:
            new_qty = current_qty + order.quantity
            if new_qty > self.config.max_position_quantity:
                raise RiskViolation(
                    f"保有上限超過: {new_qty} > {self.config.max_position_quantity}"
                )
        else:
            if current_qty <= 0 and not self.config.allow_short:
                raise RiskViolation("空売りは許可されていません（保有なしの売り）")
            if current_qty > 0 and order.quantity > current_qty and not self.config.allow_short:
                raise RiskViolation(
                    f"保有数量を超える売り: sell={order.quantity}, hold={current_qty}"
                )

    def record_order(self) -> None:
        self._roll_day()
        self.orders_today += 1
