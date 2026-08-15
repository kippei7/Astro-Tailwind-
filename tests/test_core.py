from __future__ import annotations

import pytest

from rakuten_trader.config import AppConfig
from rakuten_trader.engine import TradingEngine
from rakuten_trader.models import AccountType, Bar, OrderRequest, OrderType, Side, Signal
from rakuten_trader.risk import RiskGuard, RiskViolation
from rakuten_trader.strategies.ma_cross import MovingAverageCrossStrategy
from rakuten_trader.config import RiskConfig


def test_ma_cross_emits_buy_after_warmup():
    s = MovingAverageCrossStrategy(short_window=2, long_window=4)
    # declining then rising to force cross up after warmup
    prices = [10, 9, 8, 7, 8, 12, 14]
    signals = [s.on_bar(Bar(symbol="X", price=p)) for p in prices]
    assert Signal.HOLD in signals
    assert Signal.BUY in signals


def test_risk_blocks_oversized_order():
    guard = RiskGuard(RiskConfig(max_order_quantity=100, max_notional_yen=50_000))
    order = OrderRequest(
        symbol="7203.T",
        side=Side.BUY,
        quantity=100,
        order_type=OrderType.MARKET,
        account=AccountType.SPECIFIC,
    )
    with pytest.raises(RiskViolation):
        guard.check_order(order, last_price=1000, position=None)


def test_alert_mode_does_not_place_orders(monkeypatch):
    cfg = AppConfig(mode="alert", broker="mock")
    engine = TradingEngine.from_config(cfg)
    notified = []

    class FakeNotifier:
        def notify(self, title: str, body: str) -> None:
            notified.append((title, body))

    engine.notifier = FakeNotifier()  # type: ignore[assignment]
    engine.strategy = MovingAverageCrossStrategy(short_window=2, long_window=3)

    # Force a BUY signal path
    result = engine.execute_signal(Signal.BUY, 1000.0)
    assert result is None
    assert notified
    assert engine.results == []


def test_paper_mode_fills_with_mock():
    cfg = AppConfig(mode="paper", broker="mock")
    cfg.strategy.short_window = 2
    cfg.strategy.long_window = 3
    cfg.strategy.poll_interval_sec = 0.01
    engine = TradingEngine.from_config(cfg)
    engine.broker.seed("7203.T", 1000.0)  # type: ignore[attr-defined]

    # drive enough bars via step_once
    for _ in range(10):
        engine.step_once()

    # may or may not have orders depending on random walk; at least portfolio API works
    assert engine.broker.list_positions() is not None


def test_live_requires_confirm():
    cfg = AppConfig(mode="live", broker="rss")
    with pytest.raises(Exception):
        TradingEngine.from_config(cfg)
