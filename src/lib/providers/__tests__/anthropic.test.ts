/**
 * AnthropicProvider.chat() の単体テスト
 *
 * テスト対象: src/lib/providers/anthropic.ts
 * 前提: anthropic.ts が Anthropic Messages API (client.messages.create) を使用していること。
 *       本テストはそのインターフェース仕様を明文化し、実装の正確性を保証する。
 *
 * モック戦略:
 *   - @anthropic-ai/sdk npm パッケージ全体を jest.mock() で差し替え
 *   - client.messages.create が返す値をテストケースごとに制御する
 *   - 実 API への通信は一切行わない
 */

import { AnthropicProvider } from "../anthropic";
import { ChatMessage, ModelConfig } from "@/types";

// ---------------------------------------------------------------------------
// Anthropic SDK モック
// ---------------------------------------------------------------------------

const mockMessagesCreate = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: mockMessagesCreate,
    },
  }));
});

// ---------------------------------------------------------------------------
// テストフィクスチャ
// ---------------------------------------------------------------------------

/** ユーザーメッセージ1件 */
const MESSAGES: ChatMessage[] = [
  { role: "user", content: "Hello, Claude!" },
];

/** 標準モデル設定 (claude-3-5-sonnet) */
const BASE_CONFIG: ModelConfig = {
  id: "anthropic-claude-3-5-sonnet",
  name: "Claude 3.5 Sonnet",
  provider: "anthropic",
  modelId: "claude-3-5-sonnet-20241022",
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 1024,
  },
};

/** 任意パラメータで ModelConfig を生成するヘルパー */
function buildConfig(
  modelId: string,
  overrides: Partial<ModelConfig["parameters"]> = {}
): ModelConfig {
  return {
    id: `anthropic-${modelId}`,
    name: modelId,
    provider: "anthropic",
    modelId,
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 1024,
      ...overrides,
    },
  };
}

/**
 * Messages API の最小成功レスポンスを組み立てるヘルパー。
 * content ブロック配列と usage を外部から差し込める。
 */
function buildMessagesApiResponse({
  contentBlocks = [{ type: "text" as const, text: "Test response" }] as unknown[],
  inputTokens = 10,
  outputTokens = 20,
}: {
  contentBlocks?: unknown[];
  inputTokens?: number;
  outputTokens?: number;
} = {}) {
  return {
    content: contentBlocks,
    usage: {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
    },
  };
}

/** text ブロックを生成するヘルパー */
function buildTextBlock(text: string, citations?: unknown[]) {
  const block: Record<string, unknown> = { type: "text", text };
  if (citations !== undefined) {
    block.citations = citations;
  }
  return block;
}

/** web_search_result_location タイプの citation を生成するヘルパー */
function buildWebSearchCitation(url: string) {
  return {
    type: "web_search_result_location",
    url,
  };
}

// ---------------------------------------------------------------------------
// テスト
// ---------------------------------------------------------------------------

describe("AnthropicProvider.chat()", () => {
  let provider: AnthropicProvider;

  beforeEach(() => {
    provider = new AnthropicProvider();
    mockMessagesCreate.mockReset();
  });

  // =========================================================================
  // 1. 基本パラメータ
  // =========================================================================

  describe("基本パラメータ", () => {
    it("client.messages.create を正しいパラメータで呼び出す", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
      const callArg = mockMessagesCreate.mock.calls[0][0];

      expect(callArg.model).toBe("claude-3-5-sonnet-20241022");
      expect(callArg.max_tokens).toBe(1024);
      expect(callArg.messages).toEqual([{ role: "user", content: "Hello, Claude!" }]);
      expect(callArg.temperature).toBe(0.7);
      expect(callArg.tools).toEqual([
        { type: "web_search_20250305", name: "web_search", max_uses: 5 },
      ]);
    });

    it("tools に web_search ツールが含まれる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.tools).toHaveLength(1);
      expect(callArg.tools[0].type).toBe("web_search_20250305");
      expect(callArg.tools[0].name).toBe("web_search");
      expect(callArg.tools[0].max_uses).toBe(5);
    });
  });

  // =========================================================================
  // 2. text ブロック結合
  // =========================================================================

  describe("text ブロック結合", () => {
    it("単一の text ブロックがそのまま content に格納される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [buildTextBlock("Hello from Claude")],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("Hello from Claude");
    });

    it("複数の text ブロックが連結される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("Part 1. "),
            buildTextBlock("Part 2. "),
            buildTextBlock("Part 3."),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("Part 1. Part 2. Part 3.");
    });

    it("非 text ブロック（tool_use）は content から除外される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("Before tool use. "),
            { type: "tool_use", id: "toolu_01", name: "web_search", input: {} },
            buildTextBlock("After tool use."),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("Before tool use. After tool use.");
    });

    it("text ブロックが 1 つもない場合、content は空文字になる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            { type: "tool_use", id: "toolu_01", name: "web_search", input: {} },
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.content).toBe("");
    });
  });

  // =========================================================================
  // 3. citations 抽出
  // =========================================================================

  describe("citations 抽出", () => {
    it("単一 text ブロックの web_search_result_location が抽出される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("Result.", [buildWebSearchCitation("https://example.com")]),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com"]);
    });

    it("複数の text ブロックに分散した citations がすべて統合される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("First part.", [buildWebSearchCitation("https://first.com")]),
            buildTextBlock("Second part.", [buildWebSearchCitation("https://second.org")]),
            buildTextBlock("Third part.", [buildWebSearchCitation("https://third.net")]),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual([
        "https://first.com",
        "https://second.org",
        "https://third.net",
      ]);
    });

    it("同じ URL が複数の citations に出現してもユニーク化される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("First mention.", [buildWebSearchCitation("https://example.com")]),
            buildTextBlock("Second mention.", [buildWebSearchCitation("https://example.com")]),
            buildTextBlock("Different.", [buildWebSearchCitation("https://other.com")]),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://example.com", "https://other.com"]);
    });

    it("citations が無い場合、undefined になる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [buildTextBlock("No citations here.")],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });

    it("citations フィールドが null でもクラッシュしない", async () => {
      // Arrange
      const blockWithNullCitations = { type: "text", text: "text", citations: null };
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [blockWithNullCitations],
        })
      );

      // Act & Assert: クラッシュせず実行完了する
      const result = await provider.chat(MESSAGES, BASE_CONFIG);
      expect(result.citations).toBeUndefined();
    });

    it("citations フィールド自体が存在しない text ブロックでもクラッシュしない", async () => {
      // Arrange: citations プロパティを持たない text ブロック
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [{ type: "text", text: "No citations field." }],
        })
      );

      // Act & Assert
      const result = await provider.chat(MESSAGES, BASE_CONFIG);
      expect(result.citations).toBeUndefined();
    });

    it("web_search_result_location 以外の citation タイプはスキップされる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("Result.", [
              { type: "char_location", url: "https://should-not-appear.com" },
              buildWebSearchCitation("https://correct.com"),
              { type: "document_location", document_title: "Some Doc" },
            ]),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toEqual(["https://correct.com"]);
    });

    it("すべての citation が web_search_result_location 以外の場合、citations は undefined になる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          contentBlocks: [
            buildTextBlock("Result.", [
              { type: "char_location", url: "https://should-not-appear.com" },
            ]),
          ],
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.citations).toBeUndefined();
    });
  });

  // =========================================================================
  // 4. token count
  // =========================================================================

  describe("token count", () => {
    it("usage.input_tokens / output_tokens が tokenCount に正しくマップされる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          inputTokens: 15,
          outputTokens: 25,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(15);
      expect(result.tokenCount.completion).toBe(25);
    });

    it("tokenCount.total は input + output の合計になる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          inputTokens: 100,
          outputTokens: 200,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.total).toBe(300);
    });

    it("input_tokens が 0 の場合、total は output_tokens のみになる", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(
        buildMessagesApiResponse({
          inputTokens: 0,
          outputTokens: 50,
        })
      );

      // Act
      const result = await provider.chat(MESSAGES, BASE_CONFIG);

      // Assert
      expect(result.tokenCount.prompt).toBe(0);
      expect(result.tokenCount.total).toBe(50);
    });
  });

  // =========================================================================
  // 5. maxTokens のフォールバック
  // =========================================================================

  describe("maxTokens のフォールバック", () => {
    it("config.parameters.maxTokens が undefined のとき、max_tokens: 4096 がデフォルトとして渡される", async () => {
      // Arrange
      const config = buildConfig("claude-3-5-sonnet-20241022", { maxTokens: undefined });
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(MESSAGES, config);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.max_tokens).toBe(4096);
    });

    it("maxTokens が指定されている場合、その値が max_tokens として使われる", async () => {
      // Arrange
      const config = buildConfig("claude-3-5-sonnet-20241022", { maxTokens: 2048 });
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(MESSAGES, config);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.max_tokens).toBe(2048);
    });
  });

  // =========================================================================
  // 6. SDK エラーの伝播
  // =========================================================================

  describe("SDK エラーの伝播", () => {
    it("client.messages.create が reject した場合、同じエラーで reject される", async () => {
      // Arrange
      const sdkError = new Error("API rate limit exceeded");
      mockMessagesCreate.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, BASE_CONFIG)).rejects.toThrow(
        "API rate limit exceeded"
      );
    });

    it("reject されたエラーオブジェクトの参照が保持される", async () => {
      // Arrange
      const sdkError = new Error("Network error");
      mockMessagesCreate.mockRejectedValue(sdkError);

      // Act & Assert
      await expect(provider.chat(MESSAGES, BASE_CONFIG)).rejects.toBe(sdkError);
    });
  });

  // =========================================================================
  // 7. マルチターン
  // =========================================================================

  describe("マルチターン", () => {
    it("user/assistant/user の messages が正しくマップされる", async () => {
      // Arrange
      const multiTurn: ChatMessage[] = [
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up question" },
      ];
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(multiTurn, BASE_CONFIG);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.messages).toEqual([
        { role: "user", content: "First question" },
        { role: "assistant", content: "First answer" },
        { role: "user", content: "Follow-up question" },
      ]);
    });

    it("messages が空配列でも messages: [] でクラッシュせず呼び出される", async () => {
      // Arrange
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat([], BASE_CONFIG);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.messages).toEqual([]);
    });

    it("user メッセージのみの場合も正しくマップされる", async () => {
      // Arrange
      const singleUser: ChatMessage[] = [
        { role: "user", content: "Single question" },
      ];
      mockMessagesCreate.mockResolvedValue(buildMessagesApiResponse());

      // Act
      await provider.chat(singleUser, BASE_CONFIG);

      // Assert
      const callArg = mockMessagesCreate.mock.calls[0][0];
      expect(callArg.messages).toEqual([{ role: "user", content: "Single question" }]);
    });
  });
});
