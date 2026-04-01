# 設計概要

## 設計ドキュメント一覧

| ドキュメント | 内容 |
|---|---|
| [アプリケーションアーキテクチャ設計](./app-architecture.md) | ディレクトリ構成、ページ構成、状態管理、データフロー、依存パッケージ |
| [API設計](./api-design.md) | API Routes定義、プロバイダー層設計、モデル設定ファイル仕様、エラーハンドリング |
| [フロントエンド設計](./frontend-design.md) | コンポーネント一覧・props定義、コンポーネントツリー、イベントフロー、型定義 |
| [スタイリング設計](./styling-design.md) | デザイントークン（カラー・タイポグラフィ・スペーシング）、コンポーネント別CSS |

## 要件の要約

天秤.ai クローンのローカル版。1つのプロンプトを複数のAIモデル（OpenAI / Claude / Gemini / Perplexity）に並列送信し、回答を横並び4カラムで比較表示するWebアプリケーション。

**主要機能:**
- プロンプト入力と4モデルへの並列送信
- 各モデルの回答を横並びで比較表示（Markdownレンダリング対応）
- チャット形式の会話継続（送信ごとにモデル選択変更可能）
- カラムのクリックによる拡大/縮小表示
- 回答のクリップボードコピー
- 会話リセット

**前提・制約:**
- ローカル専用（デプロイ不要）
- DB不要（ブラウザリロードで会話リセット）
- ストリーミング不要、ダークモード不要、レスポンシブ不要
- APIキーは `.env.local` で管理

## アーキテクチャ方針

### 技術スタック

| 項目 | 技術 |
|---|---|
| フレームワーク | Next.js (App Router) |
| スタイリング | CSS Modules |
| Markdown | react-markdown + remark-gfm + react-syntax-highlighter |
| AI SDK | openai, @anthropic-ai/sdk, @google/genai |
| テスト | Jest + Playwright |

### 全体構成

```
[ブラウザ] --- SPA (1ページ) ---
  │
  ├── クライアントコンポーネント
  │     └── useChat フック（状態管理）
  │           └── fetch("/api/chat")
  │
  └── API Route (POST /api/chat)
        └── プロバイダー層
              ├── OpenAI Provider
              ├── Anthropic Provider
              ├── Gemini Provider
              └── Perplexity Provider
```

### 設計原則

1. **シンプルさ優先**: 1ページ・1API Route・外部状態管理なし
2. **プロバイダー抽象化**: 各AIサービスのSDK差異をプロバイダー層で吸収
3. **到着順表示**: `Promise.allSettled` で並列リクエストし、完了したモデルから順に表示更新
4. **APIキーの安全管理**: 環境変数はサーバーサイドのみで参照（`NEXT_PUBLIC_` 不使用）
5. **個別エラーハンドリング**: 1モデルの失敗が他モデルに影響しない設計

### ディレクトリ構成（概要）

```
my_tenbin_ai/
├── config/models.ts         # モデル設定
├── src/
│   ├── app/
│   │   ├── page.tsx          # メインページ
│   │   ├── api/chat/route.ts # API Route
│   │   └── globals.css       # グローバルスタイル
│   ├── components/           # UIコンポーネント（7種）
│   ├── hooks/useChat.ts      # チャット状態管理
│   ├── lib/
│   │   ├── api-client.ts     # フロントエンドAPIクライアント
│   │   └── providers/        # AIプロバイダー層（4種）
│   └── types/index.ts        # 共通型定義
├── .env.local                # APIキー
└── .env.example              # APIキーテンプレート
```

詳細は [アプリケーションアーキテクチャ設計](./app-architecture.md#2-ディレクトリ構成) を参照。
