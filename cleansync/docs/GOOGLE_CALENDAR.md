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
GOOGLE_CALENDAR_CLIENT_ID=...
GOOGLE_CALENDAR_CLIENT_SECRET=...
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/gcal/callback
```

6. 設定画面の「Googleカレンダーを接続」を押す。

資格情報が用意できるまでの動作確認には `GCAL_MOCK=1` を使います。接続すると同期ログが残り、`gcal_event_id` にモック ID が保存されます。
