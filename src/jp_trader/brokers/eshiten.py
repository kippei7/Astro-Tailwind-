from __future__ import annotations

from datetime import datetime
from typing import Iterable, Optional

from jp_trader.brokers import Broker
from jp_trader.config import EShitenConfig
from jp_trader.eshiten_client import EShitenClient, EShitenError
from jp_trader.models import (
    OrderRequest,
    OrderResult,
    OrderStatus,
    OrderType,
    Position,
    Quote,
    normalize_issue_code,
)


class EShitenBroker(Broker):
    """立花証券 e支店 API ブローカー（Mac対応）."""

    name = "eshiten"

    def __init__(self, config: EShitenConfig, *, dry_run: bool = True) -> None:
        self.config = config
        self.dry_run = dry_run
        self.client = EShitenClient(config)

    def login(self, *, force: bool = False) -> None:
        self.client.login(force=force)

    def get_quote(self, symbol: str) -> Quote:
        price = self.client.get_market_price(symbol)
        return Quote(symbol=symbol, price=price, timestamp=datetime.now())

    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        return [self.get_quote(s) for s in symbols]

    def place_order(self, order: OrderRequest) -> OrderResult:
        order.validate_for_submit()
        price = (
            "0"
            if order.order_type is OrderType.MARKET
            else str(int(order.limit_price) if order.limit_price == int(order.limit_price) else order.limit_price)
        )
        if self.dry_run:
            return OrderResult(
                request=order,
                status=OrderStatus.DRY_RUN,
                broker_message="dry_run: CLMKabuNewOrder は送信していません",
                filled_price=order.limit_price,
            )

        resp = self.client.place_cash_order(
            symbol=order.symbol,
            side=order.side.value,
            quantity=order.quantity,
            order_price=price,
            account=order.account.value,
        )
        result_ok = str(resp.get("sResultCode", "-1")) == "0"
        transport_ok = str(resp.get("p_errno", "0")) in {"0", ""}
        ok = result_ok and transport_ok
        status = OrderStatus.SUBMITTED if ok else OrderStatus.REJECTED
        msg = resp.get("sResultText") or resp.get("p_err") or json_safe(resp)
        return OrderResult(
            request=order,
            status=status,
            broker_message=str(msg),
            broker_order_id=resp.get("sOrderNumber"),
            business_day=resp.get("sEigyouDay"),
        )

    def get_position(self, symbol: str) -> Optional[Position]:
        code = normalize_issue_code(symbol)
        try:
            rows = self.client.list_positions(code)
        except EShitenError:
            return None
        for row in rows:
            issue = normalize_issue_code(str(row.get("sIssueCode", "")))
            if issue != code:
                continue
            qty = int(float(row.get("sOrderSuryou") or row.get("sZaikouSuryou") or row.get("sSuryou") or 0))
            avg = float(row.get("sBookValue") or row.get("sHyoukaTanka") or row.get("sTanka") or 0)
            if qty <= 0:
                return None
            return Position(symbol=symbol, quantity=qty, average_price=avg)
        return None

    def list_positions(self) -> list[Position]:
        try:
            rows = self.client.list_positions("")
        except EShitenError:
            return []
        out: list[Position] = []
        for row in rows:
            issue = str(row.get("sIssueCode") or "")
            if not issue:
                continue
            qty = int(float(row.get("sOrderSuryou") or row.get("sZaikouSuryou") or row.get("sSuryou") or 0))
            avg = float(row.get("sBookValue") or row.get("sHyoukaTanka") or row.get("sTanka") or 0)
            if qty > 0:
                out.append(Position(symbol=f"{normalize_issue_code(issue)}.T", quantity=qty, average_price=avg))
        return out

    def close(self) -> None:
        # セッションは日中再利用するため、ここでは logout しない
        return None


def json_safe(obj: dict) -> str:
    import json

    return json.dumps(obj, ensure_ascii=False)[:300]
