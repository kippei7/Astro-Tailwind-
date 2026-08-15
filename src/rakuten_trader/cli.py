from __future__ import annotations

from pathlib import Path
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from rakuten_trader import __version__
from rakuten_trader.config import AppConfig, dump_example_config, load_config
from rakuten_trader.engine import TradingEngine, create_broker
from rakuten_trader.models import AccountType, OrderRequest, OrderType, Side

app = typer.Typer(
    add_completion=False,
    no_args_is_help=True,
    help="楽天証券向け自動売買アシスト（Mac: シグナル通知 / ペーパー）",
)
console = Console()


def _load(config: Optional[Path]) -> AppConfig:
    return load_config(config)


@app.command("version")
def version() -> None:
    """バージョンを表示."""
    console.print(__version__)


@app.command("init-config")
def init_config(
    path: Path = typer.Option(Path("config.yaml"), "--path", "-p"),
    force: bool = typer.Option(False, "--force", help="既存ファイルを上書き"),
) -> None:
    """Mac向けサンプル設定を生成."""
    if path.exists() and not force:
        console.print(f"[yellow]既に存在します:[/yellow] {path} (--force で上書き)")
        raise typer.Exit(code=1)
    dump_example_config(path)
    console.print(f"[green]作成しました:[/green] {path}")
    console.print(
        Panel(
            "既定は mode=alert + broker=yfinance です。\n"
            "Mac単体では楽天へ自動発注できません。シグナル通知→手動発注の流れです。",
            title="注意",
        )
    )


@app.command("quote")
def quote(
    symbol: str = typer.Argument("7203.T"),
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
) -> None:
    """現在値を1回取得."""
    cfg = _load(config)
    broker = create_broker(cfg)
    try:
        q = broker.get_quote(symbol)
        console.print(f"{q.symbol}: {q.price} ({q.timestamp:%H:%M:%S}) via {broker.name}")
    finally:
        broker.close()


@app.command("order")
def order(
    side: str = typer.Argument(..., help="buy / sell"),
    symbol: str = typer.Argument(...),
    quantity: int = typer.Argument(..., min=1),
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
    limit: Optional[float] = typer.Option(None, "--limit", help="指値。省略時は成行"),
) -> None:
    """手動注文（alert時は通知のみ / paper時は仮想約定）."""
    cfg = _load(config)
    engine = TradingEngine.from_config(cfg)
    engine.setup_logging()
    req = OrderRequest(
        symbol=symbol,
        side=Side(side.lower()),
        quantity=quantity,
        order_type=OrderType.LIMIT if limit is not None else OrderType.MARKET,
        limit_price=limit,
        account=AccountType(cfg.account),
        note="manual cli order",
    )
    quote_data = engine.broker.get_quote(symbol)

    if cfg.mode == "alert":
        engine.manual_order_guide(req, quote_data.price)
        console.print("[cyan]alert:[/cyan] 手動発注内容を通知しました（楽天へは送っていません）")
        return

    pos = engine.portfolio.get(symbol) or engine.broker.get_position(symbol)
    engine.risk.check_order(req, last_price=quote_data.price, position=pos)
    result = engine.broker.place_order(req)
    engine.risk.record_order()
    console.print(
        f"status={result.status.value} id={result.rss_order_id} msg={result.broker_message}"
    )


@app.command("run")
def run(
    config: Optional[Path] = typer.Option(None, "--config", "-c"),
    iterations: Optional[int] = typer.Option(
        None, "--iterations", "-n", help="回数指定。省略時は Ctrl+C まで"
    ),
) -> None:
    """戦略ループを実行（Mac既定: シグナル通知）."""
    cfg = _load(config)
    engine = TradingEngine.from_config(cfg)
    results = engine.run(max_iterations=iterations)
    table = Table(title="注文 / 仮想約定")
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
    if results:
        console.print(table)
    else:
        console.print("注文記録なし（alert のみ、またはシグナル未発生）")


if __name__ == "__main__":
    app()
