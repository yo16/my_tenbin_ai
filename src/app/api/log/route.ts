import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LogRequest } from "@/types";

/**
 * ISO 8601 文字列から "YYYY-MM-DD_HHmm" 形式の文字列を生成する
 */
function formatSessionStartTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}_${hours}${minutes}`;
}

/**
 * ISO 8601 文字列から "YYYY-MM-DD HH:mm:ss" 形式の表示用文字列を生成する
 */
function formatDisplayTime(isoString: string): string {
  const date = new Date(isoString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * ログファイルの内容を生成する
 */
function buildLogContent(body: LogRequest): string {
  const sessionDisplay = formatDisplayTime(body.sessionStartTime);
  const separator = "========================================";
  const messageSeparator = "--------------------------------------------------------";

  const lines: string[] = [
    separator,
    `Session: ${sessionDisplay}`,
    `Model: ${body.provider} / ${body.modelId}`,
    separator,
    "",
  ];

  for (const message of body.messages) {
    const role = message.role === "user" ? "User" : "Assistant";
    const timestamp = message.timestamp
      ? formatDisplayTime(message.timestamp)
      : sessionDisplay;
    lines.push(`[${timestamp}] ${role}:`);
    lines.push(message.content);
    lines.push(messageSeparator);
  }

  return lines.join("\n");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. リクエストボディのパース
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "リクエストボディのJSONが不正です。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  // 2. バリデーション
  const candidate = body as Partial<LogRequest>;

  if (
    !candidate.sessionStartTime ||
    typeof candidate.sessionStartTime !== "string"
  ) {
    return NextResponse.json(
      { error: "sessionStartTimeが指定されていません。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!candidate.modelId || typeof candidate.modelId !== "string") {
    return NextResponse.json(
      { error: "modelIdが指定されていません。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!candidate.modelName || typeof candidate.modelName !== "string") {
    return NextResponse.json(
      { error: "modelNameが指定されていません。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!candidate.provider || typeof candidate.provider !== "string") {
    return NextResponse.json(
      { error: "providerが指定されていません。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (
    !candidate.messages ||
    !Array.isArray(candidate.messages) ||
    candidate.messages.length === 0
  ) {
    return NextResponse.json(
      { error: "messagesが空です。少なくとも1件のメッセージが必要です。", code: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  for (const msg of candidate.messages) {
    if (
      !msg ||
      typeof msg !== "object" ||
      !("role" in msg) ||
      !("content" in msg) ||
      (msg.role !== "user" && msg.role !== "assistant") ||
      typeof msg.content !== "string"
    ) {
      return NextResponse.json(
        {
          error:
            "messagesの形式が不正です。各メッセージにroleとcontentが必要です。",
          code: "INVALID_REQUEST",
        },
        { status: 400 }
      );
    }
  }

  const validatedBody = candidate as LogRequest;

  // 3. ファイル名の生成
  const timePrefix = formatSessionStartTime(validatedBody.sessionStartTime);
  // ファイル名に使えない文字を除去（スラッシュ、バックスラッシュ、コロン等）
  const safeProvider = validatedBody.provider.replace(/[/\\:*?"<>|]/g, "_");
  const safeModelId = validatedBody.modelId.replace(/[/\\:*?"<>|]/g, "_");
  const fileName = `${timePrefix}_${safeProvider}_${safeModelId}.txt`;

  // 4. ログディレクトリとファイルパスの構築
  const logDir = path.join(process.cwd(), "log");
  const filePath = path.join(logDir, fileName);

  // 5. ファイル書き込み
  try {
    await mkdir(logDir, { recursive: true });
    const content = buildLogContent(validatedBody);
    await writeFile(filePath, content, "utf-8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `ログファイルの書き込みに失敗しました: ${message}`, code: "WRITE_ERROR" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, fileName });
}
