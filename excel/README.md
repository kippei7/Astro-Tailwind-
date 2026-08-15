# Excel / RSS ブリッジ（Windows専用）

Mac では使いません。Parallels 等で Windows を用意し、MarketSpeed II RSS で実発注する場合のみ:

1. マクロ有効ブック `rss_bridge.xlsm` を作成
2. VBA 参照設定で `MarketSpeed2_RSS_vba` を有効化
3. `RssBridge.bas` をインポート
4. `Quotes` シートに銘柄と `=RSS("7203.T","現在値")` を配置
5. `config.yaml` で `mode: live` / `broker: rss`
