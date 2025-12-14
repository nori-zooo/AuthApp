# React Native ＋ Expo ＋ Supabase ＋ GeminiAPI App

## 概要
元々は、「ログイン認証」を検証するために立ち上げたプロジェクトでしたが、
現在は、生成AIによるコード生成のと技術検証用のアプリになってます。。。

React Native ＋ Expo　を用いたモバイルアプリで、
バックエンドに Supabase、AI応答に Gemini API を利用しています。

## 作成背景・目的
- モバイルアプリ開発の実践
- BaaS（Supabase）を用いた認証・DB設計の理解
- AI API（Gemini）の実運用経験

### 何故この技術を選んだか

既存システムのフロント業務（営業、現場検査員 等）で、モバイルアプリを通じて基幹システムとシームレスに連携できれば良いなと考え、以下の技術を選定してます。

- **React Native（Expo）**
  - クロスプラットフォーム開発であること
  - Web開発者にとってハードルが低いこと
  - Expoを利用することで、「環境構築・開発・ビルド・デプロイ」が圧倒的に楽になること
  - React Native は利用者が多く、学習リソースやコード例が豊富なため、
    AIによるコード生成を行う場合に相性が良いと判断したから

- **Supabase**
  - 認証・DB・API を一体で管理でき、バックエンド開発コストを抑えられるため
  - PostgreSQL を利用できるため、将来的に基幹システムとの連携が可能かどうかを検証したかったから

- **Gemini　API**
  - 娘の数学の宿題を解かせてみたいと考え、カメラ＋画像解析 を検証したかったから
  - また、昨今の生成AIの進化スピードは目を見張るものがあり、動画解析にも対応できるようになったと聞いたため、その実力を確認したかったから


## 使用技術

### フロントエンド
- **React Native（Expo）**: モバイルアプリフレームワーク
- **TypeScript**: 型安全な開発環境
- **NativeWind**: TailwindCSSベースのスタイリング
- **Gluestack UI**: UIコンポーネントライブラリ

### バックエンド・認証
- **Supabase**: BaaS（Auth / Database / Edge Functions）
- **@react-native-async-storage/async-storage**: セッション永続化
- **Gemini API**: AI応答生成

### ナビゲーション・状態管理
- **React Navigation**: 画面遷移・タブナビゲーション
- **React Context API**: グローバルな認証状態管理

### 地図・位置情報
- **react-native-maps**: 地図表示（Apple Maps / Google Maps）
- **expo-location**: 位置情報取得・権限管理
- **OpenStreetMap Nominatim API**: 住所検索（ジオコーディング）

### メディア・ファイル
- **expo-image-picker**: 画像選択
- **expo-document-picker**: ファイル選択
- **expo-file-system**: ファイルシステム操作
- **expo-av**: 音声・動画再生

### データ可視化・アニメーション
- **Victory Native**: グラフ・チャート表示
- **@shopify/react-native-skia**: 高性能2D描画
- **react-native-reanimated**: 滑らかなアニメーション
- **react-native-svg**: SVGレンダリング

## 主な機能

### 認証機能
- **ユーザー登録・ログイン**: メール/パスワード認証（Supabase Auth）
- **セッション管理**: 自動トークンリフレッシュ・永続化
- **ログアウト機能**: 安全なセッション破棄

### プロフィール・設定
- **ユーザー情報表示**: ログイン中のユーザー情報確認
- **設定画面**: アプリ設定の管理

### 地図・位置情報機能
- **現在地表示**: デバイスのGPS位置情報を取得・表示
- **住所検索**: OpenStreetMap APIによるジオコーディング
- **マーカー表示**: 現在地と検索地点の同時表示
- **地図操作**: ピンチズーム・スクロール対応

### メディア管理機能
- **画像アップロード**: 端末から画像選択・Supabaseストレージへアップロード
- **画像解析**: Gemini APIによる画像内容の分析・数式解答
- **音声ファイル管理**: 音声ファイルのアップロード・再生
- **文字起こし**: Supabase Edge Functionsによる音声テキスト変換
- **要約生成**: 文字起こしテキストのAI要約

### AI連携機能
- **Gemini API**: 画像解析、テキスト要約、AI応答生成
- **ストリーミング応答**: リアルタイムAI応答の受信・表示
- **数式解答**: 数学問題の解法ステップ生成
- **動画生成フロー**: 画像からの動画生成パイプライン（試行版）

### データ可視化機能
- **グラフ表示**: SVGによる棒グラフ・折れ線グラフの描画
- **Victory Native**: インタラクティブなチャート表示サンプル
- **UIコンポーネント**: カード、ボタン、入力フィールド等の実装サンプル


## 画面イメージ
<img src="docs/demo.gif" width="300" />


## アーキテクチャ概要

[Mobile App (React Native / Expo)]
        ↓
[Supabase]
  - Auth
  - Database
  - Edge Functions
        ↓
[Gemini API]


## データフロー

1. ユーザーがモバイルアプリからログイン
2. Supabase Auth により認証
3. チャット入力を Edge Functions に送信
4. Edge Functions から Gemini API を呼び出し
5. AI の応答を Supabase Database に保存
6. モバイルアプリにレスポンスを返却


## 認証・セッション管理

- Supabase Auth を利用
- メール + パスワード認証を採用
- セッション情報は Supabase SDK により管理


## AI API（Gemini）連携方針

Gemini API の APIキーはクライアントアプリに直接埋め込まず、
Supabase Edge Functions 経由で呼び出す構成としています。

これにより、APIキーの漏洩リスクを抑え、
将来的な利用制限・ロジック変更にも対応可能な設計としています。


## 補足（Supabase Free Plan について）

本アプリは Supabase の Free Plan を利用しています。
そのため、一定期間アクセスがない場合、プロジェクトが自動的に一時停止（Paused）状態になることがあります。
