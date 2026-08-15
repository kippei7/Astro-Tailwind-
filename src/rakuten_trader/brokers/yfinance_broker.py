from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from rakuten_trader.brokers import Broker
from rakuten_trader.models import (
    OrderRequest,
    OrderResult,
    OrderStatus,
    Position,
    Quote,
    Side,
)


class YFinanceBroker(Broker):
    """Mac/Linux 向け。yfinance で価格取得し、paper/dry_run で仮想約定する.

    楽天証券への実発注は行いません（個人向け公式発注APIが無いため）。
    """

    name = "yfinance"

    def __init__(self, *, dry_run: bool = True) -> None:
        try:
            import yfinance as yf  # noqa: F401
        except ImportError as exc:
            raise RuntimeError(
                "yfinance が必要です: pip install 'rakuten-trader[mac]'"
            ) from exc
        self.dry_run = dry_run
        self._positions: dict[str, Position] = {}
        self._history: list[OrderResult] = []
        self._order_seq = 1

    def get_quote(self, symbol: str) -> Quote:
        import math

        import yfinance as yf

        ticker = yf.Ticker(symbol)
        price: float | None = None

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
                raise RuntimeError(f"yfinance で価格を取得できません: {symbol}")
            price = float(hist["Close"].iloc[-1])

        return Quote(symbol=symbol, price=round(float(price), 2), timestamp=datetime.now())
    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        return [self.get_quote(s) for s in symbols]

    def place_order(self, order: OrderRequest) -> OrderResult:
        order.validate_for_submit()
        quote = self.get_quote(order.symbol)
        fill = order.limit_price if order.limit_price is not None else quote.price
        order_id = self._order_seq
        self._order_seq += 1

        if self.dry_run:
            result = OrderResult(
                request=order,
                status=OrderStatus.DRY_RUN,
                broker_message="dry_run: 楽天へは発注していません（価格参照のみ）",
                filled_price=fill,
                rss_order_id=order_id,
            )
            self._history.append(result)
            return result

        self._apply_fill(order, fill)
        result = OrderResult(
            request=order,
            status=OrderStatus.FILLED,
            broker_message="paper: yfinance価格で仮想約定（実口座未反映）",
            filled_price=fill,
            rss_order_id=order_id,
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
                raise ValueError("売数量が保有を超えています（paper）")
            remain = pos.quantity - order.quantity
            if remain == 0:
                del self._positions[order.symbol]
            else:
                self._positions[order.symbol] = Position(
                    symbol=order.symbol,
                    quantity=remain,
                    average_price=pos.average_price,
                )

    def get_position(self, symbol: str) -> Optional[Position]:
        return self._positions.get(symbol)

    def list_positions(self) -> list[Position]:
        return list(self._positions.values())
