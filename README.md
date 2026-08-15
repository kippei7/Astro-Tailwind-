# 日本株自動売買アシスト（Mac + 立花証券 e支店 API）

MacBook だけで **公式APIによる日本株の自動売買** を行うための CLI です。

## なぜ立花証券か

| 証券会社 | Mac単体で自動発注 | 備考 |
|---------|------------------|------|
| **立花証券 e支店 API** | **○** | OS非依存の公式REST。本ツールの対象 |
| 三菱UFJ eスマート（kabuステーションAPI） | × | Windows上でkabuステーション常駐が必要 |
| 楽天証券（MarketSpeed II RSS） | × | Windows + Excel 必須 |

公式案内: https://www.e-shiten.jp/api/

## セットアップ

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp config.example.yaml config.yaml
```

### 口座・API鍵（デモ推奨）

1. [e支店](https://www.e-shiten.jp/) で口座開設（デモ環境あり）
2. 標準Web → お客様情報 → **e支店・API利用設定** を有効化
3. `e_api_authid.txt` と `e_api_private_key.pem` を `secrets/` へ配置
4. `secrets/file_pwd2.txt` に第二パスワードを記載（`chmod 600 secrets/*`）

詳細は `secrets/README.md`。

## 使い方

```bash
# ログイン（仮想URL=1日券を取得）
jp-trader login

# 時価
jp-trader quote 7203.T

# 保有照会
jp-trader positions

# 手動注文（既定 dry_run = 実発注しない）
jp-trader order buy 7203.T 100

# 戦略ループ（移動平均クロス）
jp-trader run -n 30
```

### 実発注（本番）

1. `config.yaml` の `eshiten.base_url` を本番URLへ
2. `mode: live`
3. `JP_TRADER_CONFIRM_LIVE=1 jp-trader order buy 7203.T 100`

**約定は取消できません。必ずデモ環境で動作確認してください。**

## モード

| mode | 動作 |
|------|------|
| `alert` | シグナル通知のみ |
| `dry_run` | ログイン・時価は可。発注は送らない（推奨初期値） |
| `paper` | yfinance/mock で仮想約定 |
| `live` | e支店へ実発注（要確認フラグ） |

## 免責

投資判断・損益は自己責任です。証券会社の規約・法令を守って利用してください。

## 開発

```bash
pytest
```
