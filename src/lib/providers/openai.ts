import OpenAI from "openai";
import { ChatMessage, ModelConfig, TokenCount } from "@/types";

export interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}

// GPT-5系やo系の推論モデルはtemperatureとmax_tokensが使えない
function isReasoningModel(modelId: string): boolean {
  return /^(gpt-5|o[1-4])/.test(modelId);
}

export class OpenAIProvider {
  async chat(messages: ChatMessage[], config: ModelConfig): Promise<ProviderResponse> {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const reasoning = isReasoningModel(config.modelId);
    const response = await client.chat.completions.create({
      model: config.modelId,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      ...(reasoning
        ? { max_completion_tokens: config.parameters.maxTokens }
        : {
            temperature: config.parameters.temperature,
            max_tokens: config.parameters.maxTokens,
          }),
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
