from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from jp_trader import __version__
from jp_trader.config import AppConfig, dump_example_config, load_config
from jp_trader.engine import TradingEngine, create_broker
from jp_trader.models import AccountType, OrderRequest, OrderType, Side

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="日本株自動売買アシスト（立花証券 e支店 API / Mac対応）",
)
console = Console()


def _load(config: Optional[Path]) -> AppConfig:
    return load_config(config)


@app.command("version")
def version() -> None:
    console.print(__version__)


@app.command("init-config")
def init_config(
    path: Path = typer.Option(Path("config.yaml"), "--path", "-p"),
    force: bool = typer.Option(False, "--force"),
) -> None:
    """サンプル設定を生成."""
    if path.exists() and not force:
        console.print(f"[yellow]既に存在します:[/yellow] {path}")
        raise typer.Exit(1)
    dump_example_config(path)
    console.print(f"[green]作成:[/green] {path}")
    console.print(
        Panel(
            "既定は mode=dry_run + broker=eshiten（デモURL）。\n"
            "口座開設後、secrets/ に認証ID・秘密鍵・第二パスワードを配置してください。\n"
            "まずはデモ環境で login / quote を確認してください。",
            title="次のステップ",
        )
    )


@app.command("login")
def login(
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
    force: bool = typer.Option(False, "--force", help="セッションを再取得"),
) -> None:
    """e支店 API にログインし仮想URL（1日券）を保存."""
    cfg = _load(config)
    if cfg.broker != "eshiten":
        console.print("broker=eshiten の設定が必要です")
        raise typer.Exit(1)
    from jp_trader.brokers.eshiten import EShitenBroker

    broker = EShitenBroker(cfg.eshiten, dry_run=True)
    broker.login(force=force)
    console.print("[green]ログイン成功[/green] セッションを secrets/session.json に保存しました")


@app.command("quote")
def quote(
    symbol: str = typer.Argument("7203.T"),
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
) -> None:
    """現在値を取得."""
    cfg = _load(config)
    broker = create_broker(cfg)
    try:
        if hasattr(broker, "login") and cfg.broker == "eshiten":
            broker.login(force=False)  # type: ignore[attr-defined]
        q = broker.get_quote(symbol)
        console.print(f"{q.symbol}: {q.price} ({q.timestamp:%H:%M:%S}) via {broker.name}")
    finally:
        broker.close()


@app.command("positions")
def positions(config: Optional[Path] = typer.Option(None, "--config", "-c")) -> None:
    """現物保有を表示."""
    cfg = _load(config)
    broker = create_broker(cfg)
    try:
        if hasattr(broker, "login") and cfg.broker == "eshiten":
            broker.login(force=False)  # type: ignore[attr-defined]
        rows = broker.list_positions()
        if not rows:
            console.print("保有なし / 未対応ブローカー")
            return
        table = Table(title="Positions")
        table.add_column("symbol")
        table.add_column("qty")
        table.add_column("avg")
        for p in rows:
            table.add_row(p.symbol, str(p.quantity), f"{p.average_price:.1f}")
        console.print(table)
    finally:
        broker.close()


@app.command("order")
def order(
    side: str = typer.Argument(..., help="buy / sell"),
    symbol: str = typer.Argument(...),
    quantity: int = typer.Argument(..., min=1),
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
    limit: Optional[float] = typer.Option(None, "--limit"),
) -> None:
    """手動注文（dry_run既定。liveは要確認フラグ）."""
    cfg = _load(config)
    engine = TradingEngine.from_config(cfg)
    engine.setup_logging()
    if cfg.broker == "eshiten" and hasattr(engine.broker, "login"):
        engine.broker.login(force=False)  # type: ignore[attr-defined]
    req = OrderRequest(
        symbol=symbol,
        side=Side(side.lower()),
        quantity=quantity,
        order_type=OrderType.LIMIT if limit is not None else OrderType.MARKET,
        limit_price=limit,
        account=AccountType(cfg.account),
        note="cli order",
    )
    quote_data = engine.broker.get_quote(symbol)
    if cfg.mode == "alert":
        console.print(f"[cyan]alert[/cyan] {req.side.value} {symbol} x{quantity} @~{quote_data.price}")
        return
    pos = engine.portfolio.get(symbol) or engine.broker.get_position(symbol)
    engine.risk.check_order(req, last_price=quote_data.price, position=pos)
    result = engine.broker.place_order(req)
    engine.risk.record_order()
    console.print(
        f"status={result.status.value} id={result.broker_order_id} msg={result.broker_message}"
    )


@app.command("run")
def run(
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
    iterations: Optional[int] = typer.Option(None, "--iterations", "-n"),
) -> None:
    """戦略ループ."""
    cfg = _load(config)
    engine = TradingEngine.from_config(cfg)
    if cfg.broker == "eshiten" and hasattr(engine.broker, "login"):
        engine.setup_logging()
        engine.broker.login(force=False)  # type: ignore[attr-defined]
    results = engine.run(max_iterations=iterations)
    if not results:
        console.print("注文記録なし")
        return
    table = Table(title="Orders")
    table.add_column("side")
    table.add_column("symbol")
    table.add_column("qty")
    table.add_column("status")
    table.add_column("message")
    for r in results:
        table.add_row(
            r.request.side.value,
            r.request.symbol,
            str(r.request.quantity),
            r.status.value,
            r.broker_message,
        )
    console.print(table)


if __name__ == "__main__":
    app()
