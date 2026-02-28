import Anthropic from "@anthropic-ai/sdk";
import type {
  LlmProvider,
  GenerateTextRequest,
  GenerateTextResponse,
} from "./types.js";

function splitSystemAndRest(messages: { role: string; content: string }[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  return { system, rest };
}

export class AnthropicProvider implements LlmProvider {
  public readonly id = "anthropic" as const;
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    });
  }

  async generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse> {
    const { system, rest } = splitSystemAndRest(req.messages);

    const createParams: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxOutputTokens ?? 2048,
      messages: rest.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      ...(req.extra ?? {}),
    };
    if (system) createParams.system = system;
    if (typeof req.temperature === "number")
      createParams.temperature = req.temperature;
    const msg = await this.client.messages.create(
      createParams as unknown as Parameters<Anthropic["messages"]["create"]>[0]
    );

    const content = "content" in msg ? msg.content : [];
    const text =
      Array.isArray(content)
        ? content
            .map((b: { type?: string; text?: string }) =>
              b?.type === "text" ? b.text : ""
            )
            .filter(Boolean)
            .join("")
        : "";

    const usage = "usage" in msg ? (msg.usage as unknown as Record<string, number>) : undefined;
    const usageObj = usage
      ? {
          ...(usage.input_tokens !== undefined && {
            inputTokens: usage.input_tokens,
          }),
          ...(usage.output_tokens !== undefined && {
            outputTokens: usage.output_tokens,
          }),
          ...(usage.total_tokens !== undefined && {
            totalTokens: usage.total_tokens,
          }),
        }
      : undefined;
    return {
      text,
      raw: msg,
      ...(usageObj && Object.keys(usageObj).length > 0 ? { usage: usageObj } : {}),
    };
  }
}
