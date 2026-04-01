# API設計

## 関連ドキュメント

- [設計概要](./overview.md)
- [アプリケーションアーキテクチャ設計](./app-architecture.md)
- [フロントエンド設計](./frontend-design.md)

---

## 1. API Routes 一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/chat` | 指定モデルにチャットメッセージを送信し、回答を取得 |

API Route は1つのみ。`modelId` パラメータで送信先プロバイダーを切り替える。

## 2. エンドポイント詳細

### POST /api/chat

#### ファイル配置

```
src/app/api/chat/route.ts
```

#### リクエスト

```typescript
interface ChatRequest {
  /** 送信先モデルのID（config/models.ts の id に対応） */
  modelId: string;
  /** 会話履歴（ユーザーとアシスタントのメッセージ一覧） */
  messages: ChatMessage[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}
```

**リクエスト例:**

```json
{
  "modelId": "openai",
  "messages": [
    { "role": "user", "content": "TypeScriptの利点を教えてください" },
    { "role": "assistant", "content": "TypeScriptの主な利点は..." },
    { "role": "user", "content": "もう少し詳しく説明してください" }
  ]
}
```

#### レスポンス

**成功時 (200):**

```typescript
interface ChatResponse {
  /** モデルからの回答テキスト */
  content: string;
  /** 使用トークン数 */
  tokenCount: TokenCount;
}

interface TokenCount {
  /** 入力トークン数 */
  prompt: number;
  /** 出力トークン数 */
  completion: number;
  /** 合計トークン数 */
  total: number;
}
```

```json
{
  "content": "TypeScriptの主な利点について詳しく説明します...",
  "tokenCount": {
    "prompt": 150,
    "completion": 320,
    "total": 470
  }
}
```

**エラー時 (400/500):**

```typescript
interface ChatErrorResponse {
  /** エラーメッセージ */
  error: string;
  /** エラーコード */
  code: "INVALID_MODEL" | "API_KEY_MISSING" | "RATE_LIMITED" | "PROVIDER_ERROR" | "UNKNOWN_ERROR";
}
```

```json
{
  "error": "OpenAI APIキーが設定されていません",
  "code": "API_KEY_MISSING"
}
```

#### ステータスコード

| コード | 条件 |
|--------|------|
| 200 | 正常応答 |
| 400 | 不正なリクエスト（modelId不正、messages空） |
| 500 | プロバイダーエラー（APIキー未設定、レート制限、ネットワークエラー等） |

## 3. API Route 実装方針

### route.ts の構造

```typescript
// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getProvider } from "@/lib/providers";
import { MODEL_CONFIGS } from "../../../../config/models";

export async function POST(request: NextRequest) {
  // 1. リクエストボディのパース・バリデーション
  // 2. modelId からモデル設定を取得
  // 3. 対応するプロバイダーを取得
  // 4. プロバイダー経由でAPIリクエスト送信
  // 5. レスポンスを統一フォーマットに変換して返却
  // 6. エラーハンドリング
}
```

### バリデーション

- `modelId` が `MODEL_CONFIGS` に存在するか確認
- `messages` が空でないか確認
- `messages` の各要素に `role` と `content` が存在するか確認

## 4. プロバイダー層設計

各AIサービスのSDK呼び出しを抽象化するプロバイダー層を設ける。

### インターフェース

```typescript
// src/lib/providers/index.ts

interface AIProvider {
  /** チャットリクエストを送信し、回答を取得 */
  chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse>;
}

interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}
```

### プロバイダーファクトリ

```typescript
// src/lib/providers/index.ts

export function getProvider(providerId: string): AIProvider {
  switch (providerId) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "gemini":
      return new GeminiProvider();
    case "perplexity":
      return new PerplexityProvider();
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}
```

### 各プロバイダー実装

#### OpenAI (`src/lib/providers/openai.ts`)

```typescript
import OpenAI from "openai";

export class OpenAIProvider implements AIProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: config.parameters.temperature,
      max_tokens: config.parameters.maxTokens,
    });
    return {
      content: response.choices[0].message.content ?? "",
      tokenCount: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
    };
  }
}
```

#### Anthropic (`src/lib/providers/anthropic.ts`)

```typescript
import Anthropic from "@anthropic-ai/sdk";

export class AnthropicProvider implements AIProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: config.modelId,
      max_tokens: config.parameters.maxTokens ?? 4096,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: config.parameters.temperature,
    });
    const content = response.content
      .filter(block => block.type === "text")
      .map(block => block.text)
      .join("");
    return {
      content,
      tokenCount: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
    };
  }
}
```

#### Gemini (`src/lib/providers/gemini.ts`)

```typescript
import { GoogleGenAI } from "@google/genai";

export class GeminiProvider implements AIProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
    // Gemini は会話履歴を contents 形式で渡す
    const contents = messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const response = await ai.models.generateContent({
      model: config.modelId,
      contents,
      config: {
        temperature: config.parameters.temperature,
        maxOutputTokens: config.parameters.maxTokens,
      },
    });
    return {
      content: response.text ?? "",
      tokenCount: {
        prompt: response.usageMetadata?.promptTokenCount ?? 0,
        completion: response.usageMetadata?.candidatesTokenCount ?? 0,
        total: response.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }
}
```

#### Perplexity (`src/lib/providers/perplexity.ts`)

```typescript
import OpenAI from "openai";

export class PerplexityProvider implements AIProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    // Perplexity は OpenAI互換API
    const client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: "https://api.perplexity.ai",
    });
    const response = await client.chat.completions.create({
      model: config.modelId,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: config.parameters.temperature,
      max_tokens: config.parameters.maxTokens,
    });
    return {
      content: response.choices[0].message.content ?? "",
      tokenCount: {
        prompt: response.usage?.prompt_tokens ?? 0,
        completion: response.usage?.completion_tokens ?? 0,
        total: response.usage?.total_tokens ?? 0,
      },
    };
  }
}
```

## 5. モデル設定ファイル

### 型定義

```typescript
// src/types/index.ts より（設定に関わる型）

interface ModelConfig {
  /** 内部識別子（プロバイダー名と一致） */
  id: string;
  /** UI表示名 */
  name: string;
  /** プロバイダー識別子 */
  provider: "openai" | "anthropic" | "gemini" | "perplexity";
  /** APIに送信するモデルID */
  modelId: string;
  /** デフォルトで選択状態にするか */
  enabled: boolean;
  /** モデルパラメータ */
  parameters: ModelParameters;
}

interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
}
```

### 設定ファイル実装

```typescript
// config/models.ts

import { ModelConfig } from "@/types";

// OpenAI モデル一覧: https://platform.openai.com/docs/models
// Anthropic モデル一覧: https://docs.anthropic.com/en/docs/about-claude/models
// Google Gemini モデル一覧: https://ai.google.dev/gemini-api/docs/models
// Perplexity モデル一覧: https://docs.perplexity.ai/guides/model-cards

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    provider: "openai",
    modelId: "gpt-4.1",
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: "anthropic",
    name: "Claude",
    provider: "anthropic",
    modelId: "claude-sonnet-4-6",
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    provider: "gemini",
    modelId: "gemini-2.5-flash",
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
  {
    id: "perplexity",
    name: "Perplexity",
    provider: "perplexity",
    modelId: "sonar-pro",
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 4096,
    },
  },
];
```

## 6. エラーハンドリング方針

### エラーの分類と対応

| エラー種別 | コード | HTTPステータス | 対応 |
|---|---|---|---|
| 不正なmodelId | `INVALID_MODEL` | 400 | リクエストバリデーションで検出 |
| APIキー未設定 | `API_KEY_MISSING` | 500 | 環境変数チェックで検出 |
| レート制限 | `RATE_LIMITED` | 500 | SDK例外をキャッチ |
| プロバイダーエラー | `PROVIDER_ERROR` | 500 | SDK例外をキャッチ |
| その他 | `UNKNOWN_ERROR` | 500 | 予期しない例外 |

### エラーハンドリングの実装方針

- API Route 内で try-catch を使い、すべての例外をキャッチ
- SDK固有のエラークラスを判定し、適切なエラーコードに変換
- エラーメッセージは日本語でユーザーに分かりやすく記述
- APIキーは一切エラーメッセージに含めない

```typescript
// エラーメッセージのマッピング例
const ERROR_MESSAGES: Record<string, string> = {
  API_KEY_MISSING: "{provider}のAPIキーが設定されていません。.env.localを確認してください。",
  RATE_LIMITED: "{provider}のレート制限に達しました。しばらく待ってから再試行してください。",
  PROVIDER_ERROR: "{provider}でエラーが発生しました: {detail}",
  UNKNOWN_ERROR: "予期しないエラーが発生しました。",
};
```

## 7. フロントエンドAPIクライアント

```typescript
// src/lib/api-client.ts

interface ApiClientResponse {
  content: string;
  tokenCount: TokenCount;
}

export async function sendChatRequest(
  modelId: string,
  messages: ChatMessage[]
): Promise<ApiClientResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modelId, messages }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error ?? "APIリクエストに失敗しました");
  }

  return response.json();
}
```
