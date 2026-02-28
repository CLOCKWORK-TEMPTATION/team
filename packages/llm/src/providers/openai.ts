import OpenAI from "openai";
import type {
  LlmProvider,
  GenerateTextRequest,
  GenerateTextResponse,
  LlmMessage,
} from "./types.js";

function toResponsesInput(messages: LlmMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages.filter((m) => m.role !== "system");
  if (rest.length === 0) return { instructions: system || undefined, input: "" };
  if (rest.length === 1 && rest[0]!.role === "user") {
    return {
      instructions: system || undefined,
      input: rest[0]!.content,
    };
  }
  return {
    instructions: system || undefined,
    input: rest.map((m) => ({ role: m.role, content: m.content })),
  };
}

export class OpenAIProvider implements LlmProvider {
  public readonly id = "openai" as const;

  private readonly client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY ?? "",
      baseURL: process.env.OPENAI_BASE_URL ?? undefined,
    });
  }

  async generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse> {
    const { instructions, input } = toResponsesInput(req.messages);

    const params: Record<string, unknown> = {
      model: req.model,
      input,
      ...(instructions ? { instructions } : {}),
    };

    if (typeof req.temperature === "number") params.temperature = req.temperature;
    if (typeof req.maxOutputTokens === "number")
      params.max_output_tokens = req.maxOutputTokens;

    if (req.jsonSchema) {
      params.text = {
        format: {
          type: "json_schema",
          strict: true,
          schema: req.jsonSchema,
        },
      };
    }

    if (req.extra && typeof req.extra === "object") {
      Object.assign(params, req.extra);
    }

    const response = await this.client.responses.create(
      params as unknown as Parameters<OpenAI["responses"]["create"]>[0]
    );

    const refusal = (response as { refusal?: unknown })?.refusal;
    if (refusal !== undefined && refusal !== null) {
      const msg =
        typeof refusal === "string"
          ? refusal
          : JSON.stringify(refusal);
      throw new Error(`OpenAI refusal: ${msg}`);
    }

    const text = (response as { output_text?: string }).output_text ?? "";
    const usage = (response as { usage?: Record<string, number> })?.usage;
    const usageObj =
      usage && typeof usage === "object"
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
      raw: response,
      ...(usageObj && Object.keys(usageObj).length > 0 ? { usage: usageObj } : {}),
    };
  }
}
