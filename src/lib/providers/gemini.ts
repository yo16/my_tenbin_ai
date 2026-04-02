import { GoogleGenAI } from "@google/genai";
import { ChatMessage, ModelConfig, TokenCount } from "@/types";

export interface ProviderResponse {
  content: string;
  tokenCount: TokenCount;
}

export class GeminiProvider {
  async chat(
    messages: ChatMessage[],
    config: ModelConfig
  ): Promise<ProviderResponse> {
    const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

    const contents = messages.map((m) => ({
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
