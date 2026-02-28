import { Mistral } from "@mistralai/mistralai";
import type {
  LlmProvider,
  GenerateTextRequest,
  GenerateTextResponse,
} from "./types.js";

function normalizeMistralContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((x: { type?: string; text?: string }) =>
        x?.type === "text" ? x.text : ""
      )
      .filter(Boolean)
      .join("");
  }
  return "";
}

export class MistralProvider implements LlmProvider {
  public readonly id = "mistral" as const;

  private readonly client: Mistral;

  constructor() {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is required for MistralProvider");
    this.client = new Mistral({ apiKey });
  }

  async generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse> {
    const chatParams: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
      ...(typeof req.temperature === "number" && {
        temperature: req.temperature,
      }),
      ...(typeof req.maxOutputTokens === "number" && {
        max_tokens: req.maxOutputTokens,
      }),
      ...(req.extra ?? {}),
    };
    const chat = await this.client.chat.complete(
      chatParams as Parameters<Mistral["chat"]["complete"]>[0]
    );

    const text = normalizeMistralContent(chat?.choices?.[0]?.message?.content);
    const usage = chat?.usage as
      | { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      | undefined;
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
      raw: chat,
      ...(usageObj && Object.keys(usageObj).length > 0 ? { usage: usageObj } : {}),
    };
  }
}
