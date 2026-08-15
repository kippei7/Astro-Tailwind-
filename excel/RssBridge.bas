' RssBridge.bas
' MarketSpeed II RSS の VBA 関数を Python(xlwings) から呼びやすくする薄いラッパです。
' 使い方:
'   1. Excel で新規マクロ有効ブック (.xlsm) を作成
'   2. VBA エディタで「ツール > 参照設定」から MarketSpeed2_RSS_vba にチェック
'   3. このモジュールをインポート
'   4. Quotes シートを作成し、A列に銘柄コード、B列に =RSS("7203.T","現在値") などを配置
'   5. config.yaml の rss.workbook_path にその xlsm を指定
'
' 注意: 実発注は自己責任です。必ず dry_run で動作確認してから live に切り替えてください。

Option Explicit

Private Const ORDER_ID_CELL As String = "Orders!A2"

Public Function PyNextOrderId() As Long
    Dim ws As Worksheet
    Dim currentId As Long

    On Error GoTo EnsureSheet
    Set ws = ThisWorkbook.Worksheets("Orders")
    GoTo ReadId

EnsureSheet:
    Set ws = ThisWorkbook.Worksheets.Add
    ws.Name = "Orders"
    ws.Range("A1").Value = "next_order_id"
    ws.Range("A2").Value = 1

ReadId:
    If IsEmpty(ws.Range("A2").Value) Then
        ws.Range("A2").Value = 1
    End If
    currentId = CLng(ws.Range("A2").Value)
    ws.Range("A2").Value = currentId + 1
    PyNextOrderId = currentId
End Function

' 現物の通常注文（成行/指値）を RssStockOrder_V で送信する
' side: "1"=売, "3"=買
' priceKbn: "0"=成行, "1"=指値
' account: "0"=特定, "1"=一般, "2"=NISA成長, "3"=NISAつみたて
Public Function PyStockOrder( _
    ByVal orderId As Long, _
    ByVal code As String, _
    ByVal side As String, _
    ByVal qty As Long, _
    ByVal priceKbn As String, _
    ByVal price As Variant, _
    ByVal account As String _
) As String
    Dim ret As Variant
    Dim orderPrice As Variant

    If priceKbn = "0" Then
        orderPrice = Empty
    Else
        orderPrice = price
    End If

    ' RssStockOrder_V(
    '   発注ID, 銘柄, 売買, 注文区分, SOR, 数量, 価格区分, 価格,
    '   執行条件, 期限, 口座, ...逆指値・セットは省略
    ' )
    ' 注文区分 0=通常 / SOR 0=通常 / 執行条件 1=本日中
    ret = RssStockOrder_V( _
        orderId, _
        code, _
        side, _
        "0", _
        "0", _
        CStr(qty), _
        priceKbn, _
        orderPrice, _
        "1", _
        Empty, _
        account _
    )

    PyStockOrder = CStr(ret)
End Function
