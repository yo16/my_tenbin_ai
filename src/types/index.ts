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
