import { ModelConfig } from "@/types";

// ==========================================
// AIモデル設定
// ==========================================
//
// モデルを変更する際は以下のサイトを参考にしてください:
// OpenAI:     https://platform.openai.com/docs/models
// Anthropic:  https://docs.anthropic.com/en/docs/about-claude/models
// Gemini:     https://ai.google.dev/gemini-api/docs/models
// Perplexity: https://docs.perplexity.ai/guides/model-cards

export const MODEL_CONFIGS: ModelConfig[] = [
  {
    id: "openai",
    name: "OpenAI",
    provider: "openai",
    //modelId: "gpt-4.1",
    modelId: "gpt-5.4-mini",
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
