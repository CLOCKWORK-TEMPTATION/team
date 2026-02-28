import type {
  LlmProvider,
  GenerateTextRequest,
  GenerateTextResponse,
} from "./types.js";

function joinAsPrompt(messages: { role: string; content: string }[]) {
  const sys = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const rest = messages
    .filter((m) => m.role !== "system")
    .map((m) => `[${m.role}]\n${m.content}`)
    .join("\n\n");
  return sys ? `${sys}\n\n${rest}` : rest;
}

export class GoogleProvider implements LlmProvider {
  public readonly id = "google" as const;

  async generateText(
    req: Omit<GenerateTextRequest, "provider">
  ): Promise<GenerateTextResponse> {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey)
      throw new Error("GOOGLE_API_KEY is required for GoogleProvider");

    const prompt = joinAsPrompt(req.messages);

    try {
      const genaiPath = "@google/genai";
      const mod = (await import(
        /* @vite-ignore */ genaiPath
      )) as { GoogleGenAI?: new (opts: { apiKey: string }) => unknown };
      const GoogleGenAI = mod.GoogleGenAI;
      if (GoogleGenAI) {
        const ai = new GoogleGenAI({ apiKey }) as {
          models: {
            generateContent: (opts: {
              model: string;
              contents: string;
              config?: Record<string, unknown>;
            }) => Promise<{ text?: string }>;
          };
        };
        const response = await ai.models.generateContent({
          model: req.model,
          contents: prompt,
          config: {
            maxOutputTokens: req.maxOutputTokens ?? undefined,
            temperature:
              typeof req.temperature === "number" ? req.temperature : undefined,
            responseMimeType: req.jsonSchema ? "application/json" : undefined,
            ...(req.extra ?? {}),
          },
        });
        const text = response?.text ?? "";
        return { text, raw: response };
      }
    } catch {
      // fallback to legacy
    }

    const legacy = await import("@google/generative-ai");
    const { GoogleGenerativeAI } = legacy as {
      GoogleGenerativeAI: new (apiKey: string) => {
        getGenerativeModel: (opts: { model: string }) => {
          generateContent: (prompt: string) => Promise<{
            response?: { text?: () => string };
          }>;
        };
      };
    };
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: req.model });
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() ?? "";
    return { text, raw: result };
  }
}
