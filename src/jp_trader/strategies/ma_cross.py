from __future__ import annotations

from collections import deque

from jp_trader.models import Bar, Signal
from jp_trader.strategies import Strategy


class MovingAverageCrossStrategy(Strategy):
    name = "ma_cross"

    def __init__(self, short_window: int = 5, long_window: int = 25) -> None:
        if long_window <= short_window:
            raise ValueError("long_window は short_window より大きくしてください")
        self.short_window = short_window
        self.long_window = long_window
        self._prices: deque[float] = deque(maxlen=long_window)
        self._last_signal = Signal.HOLD
        self._warmed = False

    def reset(self) -> None:
        self._prices.clear()
        self._last_signal = Signal.HOLD
        self._warmed = False

    def on_bar(self, bar: Bar) -> Signal:
        self._prices.append(bar.price)
        if len(self._prices) < self.long_window:
            return Signal.HOLD
        prices = list(self._prices)
        short_ma = sum(prices[-self.short_window :]) / self.short_window
        long_ma = sum(prices) / self.long_window
        if not self._warmed:
            self._warmed = True
            self._last_signal = Signal.BUY if short_ma >= long_ma else Signal.SELL
            return Signal.HOLD
        if short_ma > long_ma and self._last_signal != Signal.BUY:
            self._last_signal = Signal.BUY
            return Signal.BUY
        if short_ma < long_ma and self._last_signal != Signal.SELL:
            self._last_signal = Signal.SELL
            return Signal.SELL
        return Signal.HOLD
