from __future__ import annotations

import json
import logging
import shutil
import subprocess
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Optional, Protocol

from jp_trader.models import Signal

logger = logging.getLogger(__name__)


class Notifier(Protocol):
    def notify(self, title: str, body: str) -> None: ...


@dataclass
class MacNotifier:
    enabled: bool = True

    def notify(self, title: str, body: str) -> None:
        if not self.enabled:
            return
        if shutil.which("osascript") is None:
            logger.info("NOTIFY %s — %s", title, body)
            return
        script = f'display notification {json.dumps(body)} with title {json.dumps(title)}'
        subprocess.run(["osascript", "-e", script], check=False, capture_output=True)
        logger.info("NOTIFY %s — %s", title, body)


@dataclass
class WebhookNotifier:
    url: Optional[str] = None

    def notify(self, title: str, body: str) -> None:
        if not self.url:
            return
        payload = json.dumps({"text": f"*{title}*\n{body}"}).encode("utf-8")
        req = urllib.request.Request(
            self.url, data=payload, headers={"Content-Type": "application/json"}, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp.read()
        except (urllib.error.URLError, TimeoutError) as exc:
            logger.warning("Webhook失敗: %s", exc)


@dataclass
class CompositeNotifier:
    notifiers: list[Notifier]

    def notify(self, title: str, body: str) -> None:
        for n in self.notifiers:
            n.notify(title, body)


def format_signal_message(
    *, signal: Signal, symbol: str, price: float, quantity: int, mode: str
) -> tuple[str, str]:
    side = "買い" if signal is Signal.BUY else "売り" if signal is Signal.SELL else "待機"
    title = f"[jp-trader] {side}シグナル {symbol}"
    body = f"価格: {price:.1f}円 / 数量: {quantity} / mode={mode}"
    return title, body
