# アプリケーションアーキテクチャ設計

## 関連ドキュメント

- [設計概要](./overview.md)
- [API設計](./api-design.md)
- [フロントエンド設計](./frontend-design.md)
- [スタイリング設計](./styling-design.md)

---

## 1. アーキテクチャ概要

Next.js App Router を使用した1ページ完結のSPA構成。
サーバーサイドは API Routes のみを使用し、各AIサービスへのプロキシとして機能する。
クライアントサイドで状態管理を行い、DB/永続化は不要。

```
[ブラウザ]
  ├── クライアントコンポーネント（状態管理・UI）
  └── API Routes（/api/chat）
        ├── OpenAI SDK
        ├── Anthropic SDK
        ├── Google GenAI SDK
        └── OpenAI SDK（Perplexity互換）
```

## 2. ディレクトリ構成

```
my_tenbin_ai/
├── config/
│   └── models.ts              # モデル設定（型定義+設定値）
├── doc/
│   ├── requirements.md
│   └── design/
│       ├── overview.md
│       ├── app-architecture.md
│       ├── api-design.md
│       ├── frontend-design.md
│       └── styling-design.md
├── src/
│   ├── app/
│   │   ├── layout.tsx         # ルートレイアウト
│   │   ├── page.tsx           # メインページ（サーバーコンポーネント）
│   │   ├── page.module.css
│   │   └── globals.css
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx
│   │   │   └── Header.module.css
│   │   ├── PromptInput/
│   │   │   ├── PromptInput.tsx
│   │   │   └── PromptInput.module.css
│   │   ├── ModelSelector/
│   │   │   ├── ModelSelector.tsx
│   │   │   └── ModelSelector.module.css
│   │   ├── ResponsePanel/
│   │   │   ├── ResponsePanel.tsx
│   │   │   └── ResponsePanel.module.css
│   │   ├── ResponseColumn/
│   │   │   ├── ResponseColumn.tsx
│   │   │   └── ResponseColumn.module.css
│   │   ├── MarkdownRenderer/
│   │   │   ├── MarkdownRenderer.tsx
│   │   │   └── MarkdownRenderer.module.css
│   │   └── LoadingIndicator/
│   │       ├── LoadingIndicator.tsx
│   │       └── LoadingIndicator.module.css
│   ├── hooks/
│   │   └── useChat.ts         # チャット状態管理カスタムフック
│   ├── lib/
│   │   ├── api-client.ts      # フロントエンドからAPIを呼ぶクライアント
│   │   └── providers/
│   │       ├── index.ts        # プロバイダー統合エントリーポイント
│   │       ├── openai.ts
│   │       ├── anthropic.ts
│   │       ├── gemini.ts
│   │       └── perplexity.ts
│   └── types/
│       └── index.ts           # 共通型定義
├── .env.local                 # APIキー（gitignore対象）
├── .env.example               # APIキーテンプレート
├── next.config.ts
├── tsconfig.json
├── package.json
└── jest.config.ts
```

## 3. ページ構成

### ルーティング

| パス | 種別 | 説明 |
|------|------|------|
| `/` | ページ | メインページ（1ページのみ） |
| `/api/chat` | API Route | AIモデルへのチャットリクエスト |

1ページ完結のSPAのため、ルーティングは最小構成。

### ページコンポーネント構成

```
page.tsx (Server Component)
└── ChatContainer (Client Component - "use client")
    ├── Header
    │   └── リセットボタン
    ├── ResponsePanel
    │   └── ResponseColumn × N（選択されたモデル数）
    │       ├── モデル名・トークン数
    │       ├── MarkdownRenderer
    │       ├── コピーボタン
    │       └── LoadingIndicator
    ├── ModelSelector
    │   └── チェックボックス × 4
    └── PromptInput
        ├── テキスト入力欄
        └── 送信ボタン
```

## 4. 状態管理

### 方針

- React の `useState` / `useReducer` のみを使用
- 外部状態管理ライブラリ（Redux, Zustand等）は使用しない
- カスタムフック `useChat` に全チャット状態を集約

### useChat フック

```typescript
// src/hooks/useChat.ts

interface UseChatReturn {
  /** 各モデルの会話履歴 */
  conversations: Record<string, Conversation>;
  /** 各モデルの最新レスポンス状態 */
  responseStates: Record<string, ResponseState>;
  /** 選択中のモデルID一覧 */
  selectedModels: string[];
  /** 拡大表示中のモデルID（null=通常表示） */
  expandedModelId: string | null;
  /** プロンプト送信 */
  sendPrompt: (prompt: string) => Promise<void>;
  /** モデル選択の切り替え */
  toggleModel: (modelId: string) => void;
  /** カラム拡大/縮小の切り替え */
  toggleExpand: (modelId: string) => void;
  /** 全会話リセット */
  reset: () => void;
  /** 送信中かどうか */
  isSending: boolean;
}
```

### 状態の構造

```typescript
// 会話履歴（モデルごと）
interface Conversation {
  messages: Message[];
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// レスポンス状態（モデルごと）
interface ResponseState {
  status: "idle" | "loading" | "success" | "error";
  tokenCount?: number;
  error?: string;
}
```

### 状態遷移

```
[初期状態]
  conversations: {} (空)
  responseStates: 各モデル "idle"
  selectedModels: 全モデルID
  expandedModelId: null

[プロンプト送信]
  → 選択モデルの responseStates を "loading" に
  → 各モデルの conversations にユーザーメッセージ追加
  → API並列リクエスト送信
  → 各モデル到着順に:
    - conversations にアシスタントメッセージ追加
    - responseStates を "success" or "error" に
    - tokenCount を更新

[リセット]
  → 全状態を初期状態に戻す
```

## 5. データフロー

```
1. ユーザーがプロンプト入力 + 送信ボタン押下
2. useChat.sendPrompt(prompt) が呼ばれる
3. selectedModels に基づき、並列でAPIリクエストを送信
   - POST /api/chat { modelId, messages }
4. API Route が該当プロバイダーのSDKを呼び出し
5. レスポンスをクライアントに返却
6. useChat が到着順にstateを更新
7. ResponseColumn が再レンダリングされ回答表示
```

### 並列リクエストの実装方針

- `Promise.allSettled` を使用し、各モデルへのリクエストを並列実行
- 1つのモデルが失敗しても他のモデルには影響しない
- 到着順に状態を更新するため、個別の `Promise` にも `.then` でハンドラを設定

```typescript
// 概念的な実装イメージ
const sendPrompt = async (prompt: string) => {
  const promises = selectedModels.map(async (modelId) => {
    setResponseState(modelId, "loading");
    try {
      const result = await apiClient.chat(modelId, messages);
      addAssistantMessage(modelId, result.content);
      setResponseState(modelId, "success", result.tokenCount);
    } catch (error) {
      setResponseState(modelId, "error", error.message);
    }
  });
  await Promise.allSettled(promises);
};
```

## 6. 環境変数

### `.env.local`

```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AI...
PERPLEXITY_API_KEY=pplx-...
```

### `.env.example`

```
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=
PERPLEXITY_API_KEY=
```

環境変数はサーバーサイド（API Routes）でのみ参照する。
`NEXT_PUBLIC_` プレフィックスは付けない（APIキーをクライアントに露出させない）。

## 7. 依存パッケージ

### 本体

| パッケージ | 用途 |
|---|---|
| `next` | フレームワーク |
| `react` / `react-dom` | UI |
| `openai` | OpenAI + Perplexity API |
| `@anthropic-ai/sdk` | Anthropic Claude API |
| `@google/genai` | Google Gemini API |
| `react-markdown` | Markdownレンダリング |
| `remark-gfm` | GFM（テーブル等）サポート |
| `react-syntax-highlighter` | コードブロックのシンタックスハイライト |

### 開発

| パッケージ | 用途 |
|---|---|
| `typescript` | 型チェック |
| `@types/react` / `@types/react-dom` | React型定義 |
| `jest` / `@jest/globals` | ユニットテスト |
| `@testing-library/react` | コンポーネントテスト |
| `playwright` / `@playwright/test` | E2Eテスト |
