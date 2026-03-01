import type { ProviderId } from "./providers/types.js";

export type { ProviderId };

export type ModelProfileId =
  | "PLANNING"
  | "CODING"
  | "SUMMARIZE"
  | "CONTRACTS_AUGMENT"
  | "RISK_EXPLAIN"
  | "ANALYSIS";

export interface ProviderModelChoice {
  provider: ProviderId;
  model: string;
  params?: Record<string, unknown>;
}

export const MODEL_PROFILES: Record<ModelProfileId, ProviderModelChoice[]> = {
  PLANNING: [
    {
      provider: "google",
      model: "gemini-3.1-pro-preview",
      params: { thinkingConfig: { thinkingLevel: "HIGH" } },
    },
  ],

  CODING: [
    {
      provider: "openai",
      model: "gpt-5.3-codex",
      params: { reasoning_effort: "xhigh" },
    },
    {
      provider: "anthropic",
      model: "claude-opus-4-6",
      params: { thinking: "enabled" },
    },
    { provider: "mistral", model: "devstral-2512+2" },
  ],

  SUMMARIZE: [
    {
      provider: "openai",
      model: "gpt-5-mini",
      params: { reasoning_effort: "medium" },
    },
    { provider: "anthropic", model: "claude-haiku-4-5" },
  ],

  CONTRACTS_AUGMENT: [
    {
      provider: "openai",
      model: "gpt-5-mini",
      params: { reasoning_effort: "medium" },
    },
    { provider: "anthropic", model: "claude-haiku-4-5" },
  ],

  RISK_EXPLAIN: [
    {
      provider: "openai",
      model: "gpt-5-mini",
      params: { reasoning_effort: "medium" },
    },
    { provider: "anthropic", model: "claude-sonnet-4-6" },
  ],

  /** طبقة LLM للتحليل (الخطوة 1) — scan-augment */
  ANALYSIS: [
    {
      provider: "anthropic",
      model: "claude-sonnet-4-6",
      params: { thinking: { type: "adaptive" }, output_config: { effort: "medium" } },
    },
  ],
};
