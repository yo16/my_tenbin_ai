import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, ModelConfig, TokenCount } from "@/types";

export interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}

export class AnthropicProvider {
  async chat(
    messages: ChatMessage[],
    config: ModelConfig
  ): Promise<ProviderResponse> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: config.modelId,
      max_tokens: config.parameters.maxTokens ?? 4096,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: config.parameters.temperature,
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
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
