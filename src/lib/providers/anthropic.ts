import Anthropic from "@anthropic-ai/sdk";
import { ChatMessage, ModelConfig } from "@/types";
import { ProviderResponse } from "./index";

function extractCitations(
  response: Anthropic.Message
): string[] | undefined {
  const urls = new Set<string>();
  for (const block of response.content) {
    if (block.type !== "text") continue;
    const textBlock = block as Anthropic.TextBlock;
    if (!Array.isArray(textBlock.citations)) continue;
    for (const citation of textBlock.citations) {
      if (citation.type === "web_search_result_location" && citation.url) {
        urls.add(citation.url);
      }
    }
  }
  return urls.size > 0 ? Array.from(urls) : undefined;
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
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
        },
      ],
    });

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const citations = extractCitations(response);

    return {
      content,
      tokenCount: {
        prompt: response.usage.input_tokens,
        completion: response.usage.output_tokens,
        total: response.usage.input_tokens + response.usage.output_tokens,
      },
      ...(citations !== undefined ? { citations } : {}),
    };
  }
}
