import OpenAI from "openai";
import { ChatMessage, ModelConfig, TokenCount } from "@/types";

export interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}

export class PerplexityProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    const client = new OpenAI({
      apiKey: process.env.PERPLEXITY_API_KEY,
      baseURL: "https://api.perplexity.ai",
    });
    const response = await client.chat.completions.create({
      model: config.modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
