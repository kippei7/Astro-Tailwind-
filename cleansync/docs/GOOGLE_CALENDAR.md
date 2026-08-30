# Google カレンダー連携（Phase 2）

掃除予定を世帯の Google カレンダーへ同期します。

## 動き

| CleanSync | Google Calendar |
| --- | --- |
| 予定を作成 | 終日イベントを追加し、`gcal_event_id` を保存 |
| 完了 | タイトル先頭に `【済】`、色をグレー（colorId `8`） |
| リスケ | 終日の開始日を新しい予定日へ |
| キャンセル | カレンダーから削除 |

担当色: 夫 = basil (`10`)、妻 = flamingo (`4`)。

## セットアップ

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成する。
2. **Google Calendar API** を有効化する。
3. **OAuth クライアント ID**（ウェブアプリケーション）を作る。
4. 承認済みリダイレクト URI に次を追加する。
   - ローカル: `http://localhost:3000/api/gcal/callback`
   - 本番: `https://<your-domain>/api/gcal/callback`
5. `cleansync/.env.local` に入れる。

```
GOOGLE_CALENDAR_CLIENT_ID=123456789012-xxxx.apps.googleusercontent.com
GOOGLE_CALENDAR_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/gcal/callback
```

`GOOGLE_CALENDAR_CLIENT_ID` は **Client ID 本体** です。Cloud Console のクライアント詳細ページ URL（`https://console.cloud.google.com/auth/clients/...`）を貼らないでください。アプリ側でも URL から ID を抽出しますが、最初から ID だけ入れる方が確実です。

6. OAuth 同意画面が **テスト** のときは、使う Gmail をテストユーザーに追加する。
7. リダイレクト URI は一字一句一致させる（`localhost` と `127.0.0.1` は別物）。
8. 設定画面の「Googleカレンダーを接続」を押す。接続後、モック ID だけの既存予定も本物のカレンダーへ送ります。

`GCAL_MOCK=1` のデモ接続は本物のカレンダーには書き込みません。モックのまま資格情報を入れても同期されません。設定に「モック接続のまま」と出たら、連携を解除してから本物の Google で再接続してください。
