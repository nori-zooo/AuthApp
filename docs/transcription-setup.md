# 音声文字起こし機能のセットアップ手順

Music Upload 画面の「ジェミニで文字起こし」ボタンは、Supabase Edge Function `transcribe-audio` を呼び出す設計になっています。
要約ボタンは、同様に Edge Function `summarize-text` を利用します。
本リポジトリには両方の関数 (`supabase/functions/transcribe-audio/index.ts`, `supabase/functions/summarize-text/index.ts`) が含まれているため、Supabase 側にデプロイすればすぐに利用できます。
（以前に 404 だった場合は、以下の手順で関数を配置・反映してください。）

## 1. Edge Function の雛形を作成

```bash
supabase functions new transcribe-audio
```

これで `supabase/functions/transcribe-audio/index.ts` が生成されます。
既存の `solve-math` Edge Function を参考に、以下の点を実装してください。

- リクエストボディ: `{ audioUrl: string, mimeType?: string, locale?: string }`
- Supabase Storage などから `audioUrl` をフェッチしてバイナリを取得
- Google Gemini API (`gemini-1.5-flash` など) に音声ファイルを送信して文字起こし結果を受け取る
- JSON 応答: `{ transcript: string }`（失敗時は `{ error: string }`）
- CORS ヘッダ、タイムアウト処理は `solve-math` と同様に実装

> 実装済みバージョンでは、15MB を超える音声に対しては `audio too large` エラーを返し、Gemini からの 5xx／429／タイムアウト系応答は最大 3 回リトライします。

## 2. 環境変数の設定

Edge Function 側で以下の環境変数を設定します。

- `GEMINI_API_KEY`: Google AI Studio で発行した API キー
- `GEMINI_MODEL`: 任意（未指定なら `gemini-1.5-flash` 推奨）
- `TRANSCRIBE_DEADLINE_MS`: 処理のタイムアウトを必要に応じて調整（例: `24000`）
- `TRANSCRIBE_MAX_ATTEMPTS`: Gemini 呼び出しのリトライ回数（既定は 3）
- `SUMMARIZE_DEADLINE_MS`: 要約関数のタイムアウト（未設定時は 12000ms）
- `SUMMARIZE_MAX_ATTEMPTS`: 要約リクエストのリトライ回数（既定は 3）

ローカル開発中は `.env` に、デプロイ時は Supabase Dashboard の `Variables` から設定します。

## 3. 動作確認とデプロイ

ローカルで実行する場合:

```bash
supabase start
supabase functions serve transcribe-audio --env-file supabase/.env
```

Expo アプリからのリクエストが `http://localhost:54321/functions/v1/transcribe-audio` に届くよう、`SUPABASE_URL` をローカルエンドポイントに合わせて設定してください。

本番環境へのデプロイ:

```bash
supabase functions deploy transcribe-audio --project-ref <YOUR_PROJECT_REF> --no-verify-jwt
```

> ⚠️ `--no-verify-jwt` は匿名アクセスを許可するためのオプションです。必要に応じて Supabase Auth による JWT 検証を有効化してください。

## 4. トラブルシューティング

- **404 Not Found**: 関数がまだデプロイされていない、またはエンドポイント名が一致していません。
- **401 Unauthorized**: JWT が無効。`supabase.auth.getSession()` で Token を取得しているか確認。
- **500 Internal Server Error**: Gemini API からの応答に失敗している可能性。Edge Function のログを `supabase functions logs transcribe-audio` で確認します。

---

以上の手順で Edge Function を整備すると、`MusicUploadScreen` の文字起こしボタンから Gemini を呼び出せるようになります。