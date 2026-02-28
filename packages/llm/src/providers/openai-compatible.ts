import OpenAI from "openai";
import type {
  LlmProvider,
  GenerateTextRequest,
  GenerateTextResponse,
} from "./types.js";

export class OpenAICompatProvider implements LlmProvider {
  public readonly id = "openai_compat" as const;

  private readonly client: OpenAI;

  constructor() {
    const baseURL = process.env.OPENAI_COMPAT_BASE_URL;
    const apiKey = process.env.OPENAI_COMPAT_API_KEY;

    if (!baseURL || !apiKey) {
      throw new Error(
        "OPENAI_COMPAT_BASE_URL / OPENAI_COMPAT_API_KEY are required for OpenAICompatProvider"
      );
    }

    this.client = new OpenAI({ apiKey, baseURL });
  }

  async generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse> {
    const createParams: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      })),
      ...(req.extra ?? {}),
    };
    if (typeof req.temperature === "number")
      createParams.temperature = req.temperature;
    if (typeof req.maxOutputTokens === "number")
      createParams.max_tokens = req.maxOutputTokens;

    const completion = (await this.client.chat.completions.create(
      createParams as unknown as Parameters<OpenAI["chat"]["completions"]["create"]>[0]
    )) as unknown as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    };

    const text = completion.choices?.[0]?.message?.content ?? "";
    const usage = completion.usage;
    const usageObj =
      usage && typeof usage === "object"
        ? {
            ...(usage.prompt_tokens !== undefined && {
              inputTokens: usage.prompt_tokens,
            }),
            ...(usage.completion_tokens !== undefined && {
              outputTokens: usage.completion_tokens,
            }),
            ...(usage.total_tokens !== undefined && {
              totalTokens: usage.total_tokens,
            }),
          }
        : undefined;
    return {
      text,
      raw: completion,
      ...(usageObj && Object.keys(usageObj).length > 0 ? { usage: usageObj } : {}),
    };
  }
}
