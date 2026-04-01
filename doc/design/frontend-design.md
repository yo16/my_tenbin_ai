# フロントエンド設計

## 関連ドキュメント

- [設計概要](./overview.md)
- [アプリケーションアーキテクチャ設計](./app-architecture.md)
- [API設計](./api-design.md)
- [スタイリング設計](./styling-design.md)

---

## 1. コンポーネント一覧

| コンポーネント | 種別 | 説明 |
|---|---|---|
| `page.tsx` | Server Component | エントリーポイント。ChatContainerをレンダリング |
| `ChatContainer` | Client Component | 状態管理の起点。useChat フックを使用 |
| `Header` | Client Component | アプリタイトル、リセットボタン |
| `ResponsePanel` | Client Component | 回答カラム群のコンテナ |
| `ResponseColumn` | Client Component | 個別モデルの回答カラム |
| `MarkdownRenderer` | Client Component | Markdown本文のレンダリング |
| `LoadingIndicator` | Client Component | ローディング表示 |
| `ModelSelector` | Client Component | モデル選択チェックボックス群 |
| `PromptInput` | Client Component | プロンプト入力欄と送信ボタン |

## 2. コンポーネント詳細

### 2.1 page.tsx

ルートページ。サーバーコンポーネントとして `ChatContainer` を呼び出すのみ。

```typescript
// src/app/page.tsx
import { ChatContainer } from "@/components/ChatContainer/ChatContainer";

export default function Home() {
  return <ChatContainer />;
}
```

### 2.2 ChatContainer

アプリケーション全体のクライアントコンポーネント。`useChat` フックを使用して状態管理し、子コンポーネントにpropsを渡す。

```typescript
// src/components/ChatContainer/ChatContainer.tsx
"use client";

interface ChatContainerProps {
  // props なし（トップレベルのクライアントコンポーネント）
}
```

**責務:**
- `useChat` フックの呼び出し
- 子コンポーネントへのprops配分
- レイアウト構成（Header / ResponsePanel / ModelSelector / PromptInput）

### 2.3 Header

```typescript
interface HeaderProps {
  /** リセットボタン押下時のコールバック */
  onReset: () => void;
  /** 会話が存在するか（リセットボタンの有効/無効制御） */
  hasConversation: boolean;
}
```

**表示内容:**
- アプリケーションタイトル（「天秤AI」等）
- リセットボタン（会話が存在しない場合は非活性）

### 2.4 ResponsePanel

回答カラムを横並びに配置するコンテナ。拡大表示の制御もここで行う。

```typescript
interface ResponsePanelProps {
  /** モデル設定一覧 */
  models: ModelConfig[];
  /** 各モデルの会話履歴 */
  conversations: Record<string, Conversation>;
  /** 各モデルのレスポンス状態 */
  responseStates: Record<string, ResponseState>;
  /** 拡大表示中のモデルID */
  expandedModelId: string | null;
  /** カラムクリック時のコールバック */
  onToggleExpand: (modelId: string) => void;
}
```

**レイアウト動作:**
- 通常時: 4カラム等幅（`grid-template-columns: repeat(N, 1fr)`）
- 拡大時: 選択カラムのみ全幅表示、他カラムは非表示

### 2.5 ResponseColumn

個別モデルの回答を表示するカラム。

```typescript
interface ResponseColumnProps {
  /** モデル設定 */
  model: ModelConfig;
  /** 会話履歴 */
  conversation: Conversation | undefined;
  /** レスポンス状態 */
  responseState: ResponseState;
  /** 拡大表示中かどうか */
  isExpanded: boolean;
  /** カラムクリック時のコールバック */
  onToggleExpand: () => void;
}
```

**表示内容:**
- ヘッダー部: モデル名（`model.name`）、モデルID（`model.modelId`）
- トークン数: `responseState.tokenCount` があれば表示
- 回答本文: 会話履歴の各メッセージをMarkdownRendererで表示
- ローディング: `responseState.status === "loading"` 時に LoadingIndicator 表示
- エラー: `responseState.status === "error"` 時にエラーメッセージ表示
- コピーボタン: 最新の回答をクリップボードにコピー

**会話履歴の表示:**
- ユーザーメッセージとアシスタントメッセージを交互に表示
- ユーザーメッセージは簡潔なスタイルで表示（プレーンテキスト）
- アシスタントメッセージは MarkdownRenderer でレンダリング

### 2.6 MarkdownRenderer

Markdown テキストを HTML にレンダリングする。

```typescript
interface MarkdownRendererProps {
  /** Markdownテキスト */
  content: string;
}
```

**使用ライブラリ:**
- `react-markdown`: Markdownパース・レンダリング
- `remark-gfm`: GFM拡張（テーブル、タスクリスト等）
- `react-syntax-highlighter`: コードブロックのシンタックスハイライト

**実装方針:**
- `react-markdown` のカスタムコンポーネントで `code` ブロックを `react-syntax-highlighter` に差し替え
- インラインコードとブロックコードを区別して処理

```typescript
// 概念的な実装
<ReactMarkdown
  remarkPlugins={[remarkGfm]}
  components={{
    code({ inline, className, children }) {
      const language = className?.replace("language-", "") ?? "";
      if (!inline) {
        return (
          <SyntaxHighlighter language={language} style={theme}>
            {String(children)}
          </SyntaxHighlighter>
        );
      }
      return <code className={styles.inlineCode}>{children}</code>;
    },
  }}
>
  {content}
</ReactMarkdown>
```

### 2.7 LoadingIndicator

ローディング中の表示。

```typescript
interface LoadingIndicatorProps {
  /** 表示するモデル名 */
  modelName: string;
}
```

**表示内容:**
- 「{modelName} が考え中...」テキスト
- CSSアニメーションによるドットアニメーション（`...` が点滅）

### 2.8 ModelSelector

送信先モデルの選択UI。

```typescript
interface ModelSelectorProps {
  /** モデル設定一覧 */
  models: ModelConfig[];
  /** 選択中のモデルID一覧 */
  selectedModels: string[];
  /** モデル選択切り替え時のコールバック */
  onToggleModel: (modelId: string) => void;
  /** 送信中かどうか（送信中は変更不可） */
  disabled: boolean;
}
```

**表示内容:**
- 各モデルのチェックボックス + モデル名ラベル
- 横並びで表示

### 2.9 PromptInput

プロンプト入力欄と送信ボタン。

```typescript
interface PromptInputProps {
  /** 送信時のコールバック */
  onSend: (prompt: string) => void;
  /** 送信中かどうか（送信中は入力・送信不可） */
  disabled: boolean;
}
```

**動作:**
- `textarea` でプロンプトを入力
- 送信ボタンクリック or `Ctrl+Enter` で送信
- 送信後に入力欄をクリア
- 空のプロンプトでは送信しない
- 送信中は入力欄と送信ボタンを非活性に

## 3. コンポーネントツリー

```
page.tsx
└── ChatContainer ("use client")
    ├── Header
    │   └── button (リセット)
    ├── ResponsePanel
    │   ├── ResponseColumn (OpenAI)
    │   │   ├── div (ヘッダー: モデル名・トークン数)
    │   │   ├── div (メッセージ一覧)
    │   │   │   ├── div (ユーザーメッセージ)
    │   │   │   ├── MarkdownRenderer (アシスタント回答)
    │   │   │   └── ...
    │   │   ├── LoadingIndicator (loading時)
    │   │   ├── div (エラー表示, error時)
    │   │   └── button (コピー)
    │   ├── ResponseColumn (Claude)
    │   ├── ResponseColumn (Gemini)
    │   └── ResponseColumn (Perplexity)
    ├── ModelSelector
    │   ├── label + input[checkbox] (OpenAI)
    │   ├── label + input[checkbox] (Claude)
    │   ├── label + input[checkbox] (Gemini)
    │   └── label + input[checkbox] (Perplexity)
    └── PromptInput
        ├── textarea
        └── button (送信)
```

## 4. イベントフロー

### 4.1 プロンプト送信フロー

```
1. ユーザーがテキスト入力
2. 送信ボタン or Ctrl+Enter
3. PromptInput → onSend(prompt)
4. ChatContainer → useChat.sendPrompt(prompt)
5. useChat 内部:
   a. 全選択モデルの responseState を "loading" に更新
   b. 各モデルの conversations にユーザーメッセージ追加
   c. Promise.allSettled で並列APIリクエスト
   d. 各モデル到着順に:
      - conversations にアシスタント回答追加
      - responseState を "success" or "error" に更新
6. React 再レンダリング → 各 ResponseColumn が更新
```

### 4.2 モデル選択変更フロー

```
1. チェックボックスクリック
2. ModelSelector → onToggleModel(modelId)
3. ChatContainer → useChat.toggleModel(modelId)
4. useChat 内部: selectedModels を更新
5. 次回送信時に反映
```

### 4.3 カラム拡大/縮小フロー

```
1. カラムクリック
2. ResponseColumn → onToggleExpand()
3. ChatContainer → useChat.toggleExpand(modelId)
4. useChat 内部:
   - expandedModelId === modelId → null に（縮小）
   - expandedModelId !== modelId → modelId に（拡大）
5. ResponsePanel が拡大/縮小レイアウトを切り替え
```

### 4.4 リセットフロー

```
1. リセットボタンクリック
2. Header → onReset()
3. ChatContainer → useChat.reset()
4. useChat 内部: 全状態を初期値に戻す
5. 全コンポーネントが初期状態で再レンダリング
```

### 4.5 コピーフロー

```
1. コピーボタンクリック
2. ResponseColumn 内部:
   a. 最新のアシスタントメッセージの content を取得
   b. navigator.clipboard.writeText(content)
   c. ボタンテキストを一時的に「コピー済み」に変更
   d. 2秒後に「コピー」に戻す
```

## 5. 型定義一覧

以下の型を `src/types/index.ts` に定義する。

```typescript
// =============================
// モデル設定
// =============================

export interface ModelConfig {
  id: string;
  name: string;
  provider: "openai" | "anthropic" | "gemini" | "perplexity";
  modelId: string;
  enabled: boolean;
  parameters: ModelParameters;
}

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
}

// =============================
// チャット
// =============================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface Conversation {
  messages: ChatMessage[];
}

// =============================
// レスポンス状態
// =============================

export type ResponseStatus = "idle" | "loading" | "success" | "error";

export interface ResponseState {
  status: ResponseStatus;
  tokenCount?: TokenCount;
  error?: string;
}

export interface TokenCount {
  prompt: number;
  completion: number;
  total: number;
}

// =============================
// API
// =============================

export interface ChatRequest {
  modelId: string;
  messages: ChatMessage[];
}

export interface ChatResponse {
  content: string;
  tokenCount: TokenCount;
}

export interface ChatErrorResponse {
  error: string;
  code: string;
}
```
