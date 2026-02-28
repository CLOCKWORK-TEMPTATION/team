import OpenAI from "openai";

let openai: OpenAI | null = null;

export function getOpenAI() {
  openai ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY ?? "",
    baseURL: process.env.OPENAI_BASE_URL ?? undefined,
  });
  return openai;
}

export async function promptOpenAI(prompt: string, model = "gpt-4o") {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: prompt }],
  });
  return response.choices[0]?.message?.content ?? "";
}
