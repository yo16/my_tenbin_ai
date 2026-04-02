import { ChatMessage, ModelConfig, TokenCount } from "@/types";
import { OpenAIProvider } from "./openai";
import { AnthropicProvider } from "./anthropic";
import { GeminiProvider } from "./gemini";
import { PerplexityProvider } from "./perplexity";

export interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}

export interface AIProvider {
  chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse>;
}

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
