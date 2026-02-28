export type ProviderId =
  | "openai"
  | "openai_compat"
  | "anthropic"
  | "google"
  | "mistral";

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface GenerateTextRequest {
  provider: ProviderId;
  model: string;
  messages: LlmMessage[];

  temperature?: number;
  maxOutputTokens?: number;

  /**
   * JSON Schema اختياري:
   * - OpenAI Responses API: text.format = { type: "json_schema", strict: true, schema: ... }
   * - Google: responseMimeType=application/json (عند دعمها)
   * - بقية المزودين: يُستخدم عبر التعليمات + parsing محلي
   */
  jsonSchema?: Record<string, unknown>;

  /**
   * بعض المزودين لديهم إعدادات خاصة (reasoning, stop, etc)
   */
  extra?: Record<string, unknown>;
}

export interface GenerateTextResponse {
  text: string;
  raw: unknown;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

export interface LlmProvider {
  readonly id: ProviderId;
  generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse>;
}
