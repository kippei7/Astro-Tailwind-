# 楽天証券 自動売買アシスト（Mac対応）

MacBook だけで使える範囲に絞ったツールです。

## 結論（重要）

**Mac単体では楽天証券への自動発注はできません。**

| 手段 | Mac | 内容 |
|------|-----|------|
| MarketSpeed II RSS | ×（Windows専用） | Excel経由の自動発注 |
| MARKETSPEED for Mac | ○ | 手動売買アプリ（APIなし） |
| 個人向け公式REST発注API | × | 現状なし |

このツールが Mac でできること:

1. **株価監視**（yfinance）
2. **売買シグナル判定**（移動平均クロスなど）
3. **macOS通知 / Webhook** で手動発注を促す
4. **ペーパートレード**（仮想約定で戦略検証）

実口座への自動発注が必要なら、Windows（Parallels等）上の MarketSpeed II RSS が別途必要です。

## セットアップ（Mac）

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp config.example.yaml config.yaml
rakuten-trader init-config --force   # または上の cp
```

## 使い方

```bash
# 現在値（例: トヨタ）
rakuten-trader quote 7203.T

# シグナル監視 → 通知のみ（推奨スタート）
rakuten-trader run -n 30

# 手動発注案内（通知だけ）
rakuten-trader order buy 7203.T 100

# ペーパー（仮想約定）
# config.yaml で mode: paper にしてから
rakuten-trader run -n 50
```

通知は macOS 通知センターに出ます。Slack 等へ飛ばす場合は:

```yaml
notify:
  macos: true
  webhook_url: "https://hooks.slack.com/services/..."
```

または `RAKUTEN_TRADER_WEBHOOK_URL=...`

## 動作モード

| mode | 意味 |
|------|------|
| `alert` | シグナルを通知するだけ（**Mac推奨**） |
| `dry_run` | 注文オブジェクトは作るが発注しない |
| `paper` | yfinance/mock 価格で仮想約定 |
| `live` | Windows + `broker: rss` のみ（要 `RAKUTEN_TRADER_CONFIRM_LIVE=1`） |

## 実自動発注したい場合（参考）

1. Parallels / VMware 等で Windows を用意
2. MarketSpeed II + Excel + RSS を設定
3. `excel/RssBridge.bas` を xlsm に取り込み
4. `mode: live` / `broker: rss` に切り替え

楽天以外で Mac から本格API自動売買するなら、公式REST APIがある証券会社（例: 三菱UFJ eスマート証券の kabuステーションAPI ※ツール自体はWindows側常駐が必要な場合あり）の検討も現実的です。

## 免責

- 投資・売買は自己責任です
- 本ツールは学習・検証用のアシストであり、利益を保証しません
- 証券会社の利用規約・法令を守ってください
- yfinance の価格は楽天の取引画面と一致しない場合があります

## 開発

```bash
pytest
```
