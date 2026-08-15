from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable, Optional

from rakuten_trader.models import OrderRequest, OrderResult, Position, Quote


class Broker(ABC):
    """証券会社 / データソースアダプタの共通インターフェース."""

    name: str = "base"

    @abstractmethod
    def get_quote(self, symbol: str) -> Quote:
        raise NotImplementedError

    @abstractmethod
    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        raise NotImplementedError

    @abstractmethod
    def place_order(self, order: OrderRequest) -> OrderResult:
        raise NotImplementedError

    @abstractmethod
    def get_position(self, symbol: str) -> Optional[Position]:
        raise NotImplementedError

    @abstractmethod
    def list_positions(self) -> list[Position]:
        raise NotImplementedError

    def close(self) -> None:
        return None
