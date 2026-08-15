from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterable, Optional

from rakuten_trader.brokers import Broker
from rakuten_trader.config import RssConfig
from rakuten_trader.models import (
    AccountType,
    OrderRequest,
    OrderResult,
    OrderStatus,
    OrderType,
    Position,
    Quote,
)


class RssBrokerError(RuntimeError):
    pass


class RssBroker(Broker):
    """MarketSpeed II RSS + Excel(xlwings) 経由のブローカー.

    前提:
      - Windows + Excel + MarketSpeed II ログイン済み
      - RSS アドイン有効、発注可、取引暗証番号設定済み
      - excel/RssBridge.bas を取り込んだ xlsm を開いていること
    """

    name = "rss"

    def __init__(self, config: RssConfig, *, dry_run: bool = True) -> None:
        if sys.platform != "win32":
            raise RssBrokerError(
                "RssBroker は Windows 専用です。Linux/macOS では broker=mock を使ってください。"
            )
        try:
            import xlwings as xw  # type: ignore
        except ImportError as exc:
            raise RssBrokerError(
                "xlwings が必要です: pip install 'rakuten-trader[rss]'"
            ) from exc

        self.config = config
        self.dry_run = dry_run
        self._xw = xw
        workbook = Path(config.workbook_path)
        if workbook.exists():
            self._app = xw.App(visible=config.visible_excel, add_book=False)
            self._book = self._app.books.open(str(workbook.resolve()))
        else:
            # 既に開いているブック名で接続を試みる
            self._app = xw.apps.active
            if self._app is None:
                raise RssBrokerError(
                    f"Excel ブックが見つかりません: {workbook}. "
                    "MarketSpeed II RSS 用の xlsm を開いてから再実行してください。"
                )
            self._book = self._app.books[workbook.name]

    def _quote_sheet(self):
        return self._book.sheets[self.config.quote_sheet]

    def _find_symbol_row(self, symbol: str) -> int:
        sheet = self._quote_sheet()
        col = self.config.symbol_column
        row = self.config.data_start_row
        # 最大 500 銘柄想定
        for r in range(row, row + 500):
            value = sheet.range(f"{col}{r}").value
            if value is None:
                break
            if str(value).strip().upper() == symbol.strip().upper():
                return r
        raise RssBrokerError(
            f"Quotes シートに銘柄 {symbol} がありません。"
            f" {col}{row} 以降に銘柄コードを追加し、価格列へ =RSS(\"銘柄\",\"現在値\") を設定してください。"
        )

    def get_quote(self, symbol: str) -> Quote:
        sheet = self._quote_sheet()
        row = self._find_symbol_row(symbol)
        price = sheet.range(f"{self.config.price_column}{row}").value
        if price is None:
            raise RssBrokerError(f"{symbol} の現在値が空です（RSS未接続の可能性）")
        return Quote(symbol=symbol, price=float(price))

    def get_quotes(self, symbols: Iterable[str]) -> list[Quote]:
        return [self.get_quote(s) for s in symbols]

    def _next_order_id(self) -> int:
        macro = f"{self._book.name}!{self.config.vba_next_order_id}"
        result = self._app.macro(macro)()
        return int(result)

    def place_order(self, order: OrderRequest) -> OrderResult:
        order.validate_for_submit()
        order_id = order.order_id or self._next_order_id()

        if self.dry_run:
            return OrderResult(
                request=order,
                status=OrderStatus.DRY_RUN,
                broker_message=f"dry_run: RssStockOrder_V は呼びません (id={order_id})",
                rss_order_id=order_id,
            )

        price_kbn = order.order_type.rss_price_kbn()
        price = "" if order.order_type is OrderType.MARKET else str(order.limit_price)
        account = AccountType(order.account).rss_code()

        macro = f"{self._book.name}!{self.config.vba_stock_order}"
        # VBA: PyStockOrder(orderId, code, side, qty, priceKbn, price, account)
        message = self._app.macro(macro)(
            order_id,
            order.symbol,
            order.side.rss_code(),
            order.quantity,
            price_kbn,
            price,
            account,
        )
        text = str(message)
        status = OrderStatus.SUBMITTED
        if "エラー" in text or "error" in text.lower():
            status = OrderStatus.REJECTED
        return OrderResult(
            request=order,
            status=status,
            broker_message=text,
            rss_order_id=order_id,
        )

    def get_position(self, symbol: str) -> Optional[Position]:
        # RSS の保有照会シート連携は環境依存が大きいため、初期版は未対応。
        # リスク管理は戦略側のローカルポジション追跡で補完する。
        return None

    def list_positions(self) -> list[Position]:
        return []

    def close(self) -> None:
        # ユーザーが開いている Excel は閉じない
        return None
