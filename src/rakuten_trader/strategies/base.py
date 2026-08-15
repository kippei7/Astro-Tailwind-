from __future__ import annotations

from abc import ABC, abstractmethod

from rakuten_trader.models import Bar, Signal


class Strategy(ABC):
    name: str = "base"

    @abstractmethod
    def on_bar(self, bar: Bar) -> Signal:
        raise NotImplementedError

    def reset(self) -> None:
        return None
