from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

from jp_trader.brokers import Broker
from jp_trader.brokers.mock import MockBroker
from jp_trader.config import AppConfig, EnvSettings
from jp_trader.models import (
    AccountType,
    Bar,
    OrderRequest,
    OrderResult,
    OrderType,
    Position,
    Side,
    Signal,
)
from jp_trader.notify import CompositeNotifier, MacNotifier, WebhookNotifier, format_signal_message
from jp_trader.risk import RiskGuard, RiskViolation
from jp_trader.strategies import Strategy
from jp_trader.strategies.ma_cross import MovingAverageCrossStrategy

logger = logging.getLogger(__name__)


class LiveModeNotConfirmed(RuntimeError):
    pass


def create_broker(config: AppConfig) -> Broker:
    dry = config.mode in {"dry_run", "alert"}
    if config.broker == "mock":
        return MockBroker(dry_run=dry)
    if config.broker == "yfinance":
        from jp_trader.brokers.yfinance_broker import YFinanceBroker

        return YFinanceBroker(dry_run=dry)
    if config.broker == "eshiten":
        from jp_trader.brokers.eshiten import EShitenBroker

        return EShitenBroker(config.eshiten, dry_run=(config.mode != "live"))
    raise ValueError(f"未知のブローカー: {config.broker}")


def create_strategy(config: AppConfig) -> Strategy:
    return MovingAverageCrossStrategy(
        short_window=config.strategy.short_window,
        long_window=config.strategy.long_window,
    )


def create_notifier(config: AppConfig) -> CompositeNotifier:
    return CompositeNotifier(
        [MacNotifier(enabled=config.notify.macos), WebhookNotifier(url=config.notify.webhook_url)]
    )


def ensure_live_allowed(config: AppConfig) -> None:
    if not config.is_live:
        return
    settings = EnvSettings()
    if not settings.confirm_live:
        raise LiveModeNotConfirmed(
            "live モードには JP_TRADER_CONFIRM_LIVE=1 が必要です（実資金発注）。"
        )
    if config.broker != "eshiten":
        raise LiveModeNotConfirmed("live モードでは broker=eshiten を指定してください。")


@dataclass
class LocalPortfolio:
    positions: dict[str, Position] = field(default_factory=dict)

    def get(self, symbol: str) -> Optional[Position]:
        return self.positions.get(symbol)

    def apply(self, order: OrderRequest, fill_price: float | None) -> None:
        price = fill_price or order.limit_price or 0.0
        pos = self.positions.get(order.symbol)
        if order.side is Side.BUY:
            if pos is None:
                self.positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=order.quantity, average_price=price
                )
            else:
                total = pos.quantity + order.quantity
                avg = (pos.average_price * pos.quantity + price * order.quantity) / total
                self.positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=total, average_price=avg
                )
        else:
            if pos is None:
                return
            remain = max(0, pos.quantity - order.quantity)
            if remain == 0:
                del self.positions[order.symbol]
            else:
                self.positions[order.symbol] = Position(
                    symbol=order.symbol, quantity=remain, average_price=pos.average_price
                )


@dataclass
class TradingEngine:
    config: AppConfig
    broker: Broker
    strategy: Strategy
    risk: RiskGuard
    notifier: CompositeNotifier
    portfolio: LocalPortfolio = field(default_factory=LocalPortfolio)
    results: list[OrderResult] = field(default_factory=list)
    _running: bool = False

    @classmethod
    def from_config(cls, config: AppConfig) -> "TradingEngine":
        ensure_live_allowed(config)
        return cls(
            config=config,
            broker=create_broker(config),
            strategy=create_strategy(config),
            risk=RiskGuard(config.risk),
            notifier=create_notifier(config),
        )

    def setup_logging(self) -> None:
        log_dir = Path(self.config.log_dir)
        log_dir.mkdir(parents=True, exist_ok=True)
        log_file = log_dir / f"trader_{datetime.now():%Y%m%d}.log"
        logging.basicConfig(
            level=logging.INFO,
            format="%(asctime)s %(levelname)s %(message)s",
            handlers=[logging.StreamHandler(), logging.FileHandler(log_file, encoding="utf-8")],
            force=True,
        )

    def build_order(self, signal: Signal, price: float) -> Optional[OrderRequest]:
        symbol = self.config.strategy.symbol
        qty = self.config.strategy.quantity
        account = AccountType(self.config.account)
        if signal is Signal.BUY:
            return OrderRequest(
                symbol=symbol,
                side=Side.BUY,
                quantity=qty,
                order_type=OrderType.MARKET,
                account=account,
                note=f"ma_cross buy @ {price}",
            )
        if signal is Signal.SELL:
            pos = self.portfolio.get(symbol) or self.broker.get_position(symbol)
            sell_qty = min(qty, pos.quantity) if pos else qty
            if self.config.mode == "alert" and (pos is None or pos.quantity <= 0):
                sell_qty = qty
            if sell_qty <= 0:
                return None
            return OrderRequest(
                symbol=symbol,
                side=Side.SELL,
                quantity=sell_qty,
                order_type=OrderType.MARKET,
                account=account,
                note=f"ma_cross sell @ {price}",
            )
        return None

    def execute_signal(self, signal: Signal, price: float) -> Optional[OrderResult]:
        order = self.build_order(signal, price)
        if order is None:
            return None
        title, body = format_signal_message(
            signal=signal,
            symbol=order.symbol,
            price=price,
            quantity=order.quantity,
            mode=self.config.mode,
        )
        self.notifier.notify(title, body)
        if self.config.mode == "alert":
            return None

        position = self.portfolio.get(order.symbol) or self.broker.get_position(order.symbol)
        try:
            self.risk.check_order(order, last_price=price, position=position)
        except RiskViolation as exc:
            logger.warning("リスク制限: %s", exc)
            return None

        result = self.broker.place_order(order)
        self.risk.record_order()
        self.results.append(result)
        if result.status.value in {"filled", "submitted", "dry_run"}:
            self.portfolio.apply(order, result.filled_price or price)
        logger.info(
            "注文 %s %s x%d status=%s msg=%s",
            order.side.value,
            order.symbol,
            order.quantity,
            result.status.value,
            result.broker_message,
        )
        return result

    def step_once(self) -> Optional[OrderResult]:
        symbol = self.config.strategy.symbol
        quote = self.broker.get_quote(symbol)
        signal = self.strategy.on_bar(Bar(symbol=symbol, price=quote.price))
        logger.info(
            "quote %s price=%.2f signal=%s mode=%s",
            symbol,
            quote.price,
            signal.value,
            self.config.mode,
        )
        if signal is Signal.HOLD:
            return None
        return self.execute_signal(signal, quote.price)

    def run(self, *, max_iterations: int | None = None) -> list[OrderResult]:
        self.setup_logging()
        self._running = True
        logger.info(
            "開始 mode=%s broker=%s symbol=%s",
            self.config.mode,
            self.config.broker,
            self.config.strategy.symbol,
        )
        if self.config.is_live:
            logger.warning("!!! LIVE: 立花証券 e支店へ実発注します !!!")
        i = 0
        try:
            while self._running:
                self.step_once()
                i += 1
                if max_iterations is not None and i >= max_iterations:
                    break
                time.sleep(self.config.strategy.poll_interval_sec)
        except KeyboardInterrupt:
            logger.info("停止")
        finally:
            self._running = False
            self.broker.close()
        return self.results

    def stop(self) -> None:
        self._running = False
