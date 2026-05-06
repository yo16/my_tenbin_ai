import { NextRequest, NextResponse } from "next/server";
import OpenAI, { APIError as OpenAIAPIError } from "openai";
import { getProvider } from "@/lib/providers";
import { MODEL_CONFIGS } from "../../../../config/models";
import { ChatRequest, ChatErrorResponse } from "@/types";

// 構造化エラーログの型（route.ts 内ローカル）
interface ChatErrorLog {
  timestamp: string;
  provider: string;
  modelId: string;
  reqId: string;
  errorName: string;
  errorMessage: string;
  errorStatus: number | undefined;
  errorCode: string | undefined;
  errorType: string | undefined;
  errorBody: unknown;
  requestId: string | undefined;
  retryAfter: string | undefined;
  stack: string | undefined;
}

// プロバイダーごとの環境変数マッピング
const PROVIDER_ENV_KEYS: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  gemini: "GOOGLE_API_KEY",
  perplexity: "PERPLEXITY_API_KEY",
};

// プロバイダーの表示名
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  perplexity: "Perplexity",
};

function errorResponse(
  error: string,
  code: ChatErrorResponse["code"],
  status: number
): NextResponse<ChatErrorResponse> {
  return NextResponse.json({ error, code }, { status });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 相関ID（ログのひも付け用）
  const reqId = crypto.randomUUID().slice(0, 8);

  // 1. リクエストボディのパース
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "リクエストボディのJSONが不正です。",
      "UNKNOWN_ERROR",
      400
    );
  }

  // 2. バリデーション
  const { modelId, messages } = body as Partial<ChatRequest>;

  if (!modelId || typeof modelId !== "string") {
    return errorResponse(
      "modelIdが指定されていません。",
      "INVALID_MODEL",
      400
    );
  }

  const modelConfig = MODEL_CONFIGS.find((m) => m.id === modelId);
  if (!modelConfig) {
    return errorResponse(
      `モデル "${modelId}" は存在しません。`,
      "INVALID_MODEL",
      400
    );
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return errorResponse(
      "messagesが空です。少なくとも1件のメッセージが必要です。",
      "INVALID_MODEL",
      400
    );
  }

  for (const msg of messages) {
    if (
      !msg ||
      typeof msg !== "object" ||
      !("role" in msg) ||
      !("content" in msg) ||
      (msg.role !== "user" && msg.role !== "assistant") ||
      typeof msg.content !== "string"
    ) {
      return errorResponse(
        "messagesの形式が不正です。各メッセージにroleとcontentが必要です。",
        "INVALID_MODEL",
        400
      );
    }
  }

  // 3. APIキーの存在チェック
  const envKey = PROVIDER_ENV_KEYS[modelConfig.provider];
  const apiKey = process.env[envKey];
  if (!apiKey) {
    const providerName =
      PROVIDER_DISPLAY_NAMES[modelConfig.provider] ?? modelConfig.provider;
    return errorResponse(
      `${providerName}のAPIキーが設定されていません。.env.localを確認してください。`,
      "API_KEY_MISSING",
      500
    );
  }

  // 4. プロバイダー経由でリクエスト送信
  try {
    console.info(
      `[chat][reqId=${reqId}][provider=${modelConfig.provider}][model=${modelConfig.modelId}] start`
    );

    const provider = getProvider(modelConfig.provider);
    const result = await provider.chat(messages, modelConfig);

    return NextResponse.json({
      content: result.content,
      tokenCount: result.tokenCount,
      citations: result.citations,
    });
  } catch (err: unknown) {
    // 構造化エラーログ（サーバーターミナル向け。UIレスポンスは変更しない）
    {
      const isOpenAIError = err instanceof OpenAI.APIError;
      const isErrorObj = err instanceof Error;

      // ヘッダアクセスのヘルパ（Headers オブジェクトと Record<string, string> の両方に対応）
      const getHeader = (
        headers: unknown,
        key: string
      ): string | undefined => {
        if (!headers || typeof headers !== "object") return undefined;
        const h = headers as Record<string, unknown>;
        if (typeof h[key] === "string") return h[key] as string;
        // Headers オブジェクト（get メソッドあり）の場合
        if (typeof (headers as { get?: unknown }).get === "function") {
          const val = (headers as { get: (k: string) => string | null }).get(
            key
          );
          return val ?? undefined;
        }
        return undefined;
      };

      const rawHeaders = isOpenAIError
        ? (err as OpenAIAPIError).headers
        : undefined;

      const logEntry: ChatErrorLog = {
        timestamp: new Date().toISOString(),
        provider: modelConfig.provider,
        modelId: modelConfig.modelId,
        reqId,
        errorName: isErrorObj ? err.name : String(err),
        errorMessage: isErrorObj ? err.message : String(err),
        errorStatus: isOpenAIError
          ? (err as OpenAIAPIError).status
          : undefined,
        errorCode: isOpenAIError
          ? ((err as OpenAIAPIError & { code?: string }).code ?? undefined)
          : (isErrorObj
              ? ((err as Error & { code?: string }).code ?? undefined)
              : undefined),
        errorType: isOpenAIError
          ? ((err as OpenAIAPIError).type ?? undefined)
          : undefined,
        errorBody: isOpenAIError
          ? (err as OpenAIAPIError & { error?: unknown }).error
          : undefined,
        requestId: getHeader(rawHeaders, "x-request-id"),
        retryAfter: getHeader(rawHeaders, "retry-after"),
        stack: isErrorObj ? err.stack : undefined,
      };

      console.error(
        `[chat][reqId=${reqId}][provider=${modelConfig.provider}][model=${modelConfig.modelId}] error`,
        logEntry
      );
    }

    // エラーの種別を判定
    if (err instanceof Error) {
      const message = err.message.toLowerCase();

      // レート制限エラーの検出
      if (
        message.includes("rate limit") ||
        message.includes("rate_limit") ||
        message.includes("too many requests") ||
        message.includes("429")
      ) {
        const providerName =
          PROVIDER_DISPLAY_NAMES[modelConfig.provider] ?? modelConfig.provider;
        return errorResponse(
          `${providerName}のレート制限に達しました。しばらく待ってから再試行してください。`,
          "RATE_LIMITED",
          500
        );
      }

      // 認証エラー（APIキー無効）の検出
      if (
        message.includes("authentication") ||
        message.includes("api key") ||
        message.includes("apikey") ||
        message.includes("unauthorized") ||
        message.includes("401")
      ) {
        const providerName =
          PROVIDER_DISPLAY_NAMES[modelConfig.provider] ?? modelConfig.provider;
        return errorResponse(
          `${providerName}のAPIキーが無効です。.env.localを確認してください。`,
          "API_KEY_MISSING",
          500
        );
      }

      // その他のプロバイダーエラー
      const providerName =
        PROVIDER_DISPLAY_NAMES[modelConfig.provider] ?? modelConfig.provider;
      return errorResponse(
        `${providerName}でエラーが発生しました。`,
        "PROVIDER_ERROR",
        500
      );
    }

    // 予期しないエラー
    return errorResponse(
      "予期しないエラーが発生しました。",
      "UNKNOWN_ERROR",
      500
    );
  }
}
