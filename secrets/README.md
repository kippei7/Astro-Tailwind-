# 認証ファイル置き場（Git管理しません）
#
# 必要なファイル:
#   e_api_authid.txt          … 標準Webの API利用設定からDL
#   e_api_private_key.pem     … 同上（秘密鍵）
#   file_pwd2.txt             … 第二パスワード（発注用）
#
# 取得手順（v4r9 公開鍵認証）:
#   1. 立花証券 e支店で口座開設
#   2. パスキーで標準Webログイン（デモはデモWeb）
#   3. お客様情報 > e支店・API利用設定 を「利用する」
#   4. 認証ID / 秘密鍵をダウンロードしてこのディレクトリへ
#   5. file_pwd2.txt に第二パスワードを1行で書く
#   6. chmod 600 *
#
# 環境変数でも可:
#   JP_TRADER_ESHITEN_AUTH_ID
#   JP_TRADER_ESHITEN_SECOND_PASSWORD
#   API_DECRYPT_KEY  … 公式サンプルの secure_config.enc を使う場合
#
# 公式資料:
#   https://www.e-shiten.jp/api/
#   https://github.com/e-shiten-jp
