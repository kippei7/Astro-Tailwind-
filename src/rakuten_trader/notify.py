from __future__ import annotations

import json
import logging
import shutil
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional, Protocol

from rakuten_trader.models import OrderRequest, Signal

logger = logging.getLogger(__name__)


class Notifier(Protocol):
    def notify(self, title: str, body: str) -> None: ...


@dataclass
class MacNotifier:
    """macOS の通知センターへバナーを出す（osascript）."""

    enabled: bool = True

    def notify(self, title: str, body: str) -> None:
        if not self.enabled:
            return
        if shutil.which("osascript") is None:
            logger.info("NOTIFY %s — %s", title, body)
            return
        script = (
            f'display notification {json.dumps(body)} with title {json.dumps(title)}'
        )
        try:
            subprocess.run(["osascript", "-e", script], check=False, capture_output=True)
        except OSError as exc:
            logger.warning("macOS通知に失敗: %s", exc)
        logger.info("NOTIFY %s — %s", title, body)


@dataclass
class WebhookNotifier:
    """Slack / Discord / 汎用 Incoming Webhook へ POST."""

    url: Optional[str] = None

    def notify(self, title: str, body: str) -> None:
        if not self.url:
            return
        payload = json.dumps({"text": f"*{title}*\n{body}"}).encode("utf-8")
        req = urllib.request.Request(
            self.url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            logger.warning("Webhook通知に失敗: %s", exc)


@dataclass
class CompositeNotifier:
    notifiers: list[Notifier]

    def notify(self, title: str, body: str) -> None:
        for n in self.notifiers:
            n.notify(title, body)


def format_signal_message(
    *,
    signal: Signal,
    symbol: str,
    price: float,
    quantity: int,
    mode: str,
) -> tuple[str, str]:
    side = "買い" if signal is Signal.BUY else "売り" if signal is Signal.SELL else "待機"
    title = f"[楽天アシスト] {side}シグナル {symbol}"
    body = (
        f"価格: {price:.1f}円 / 推奨数量: {quantity}\n"
        f"mode={mode}\n"
        "※Mac単体では楽天へ自動発注できません。"
        "MARKETSPEED for Mac / ウェブから手動発注してください。"
    )
    return title, body


def format_order_message(order: OrderRequest, *, price: float, mode: str) -> tuple[str, str]:
    side = "買い" if order.side.value == "buy" else "売り"
    title = f"[楽天アシスト] 手動発注案内 {order.symbol}"
    body = (
        f"{side} {order.symbol} x{order.quantity} @約{price:.1f}円\n"
        f"注文種別: {order.order_type.value} / mode={mode}\n"
        "MARKETSPEED for Mac か楽天証券ウェブで同内容を発注してください。"
    )
    return title, body
