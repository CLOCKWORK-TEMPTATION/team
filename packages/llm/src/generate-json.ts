import type { ProviderId, LlmMessage } from "./providers/types.js";
import type { ModelProfileId } from "./profiles.js";
import { routeModel, getAgentSpec } from "./router.js";
import { loadPrompt } from "./prompt-loader.js";
import { parseJsonLoose } from "./json.js";

import { OpenAIProvider } from "./providers/openai.js";
import { OpenAICompatProvider } from "./providers/openai-compatible.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GoogleProvider } from "./providers/google.js";
import { MistralProvider } from "./providers/mistral.js";

function getProvider(provider: ProviderId) {
  switch (provider) {
    case "openai":
      return new OpenAIProvider();
    case "openai_compat":
      return new OpenAICompatProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "google":
      return new GoogleProvider();
    case "mistral":
      return new MistralProvider();
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export interface GenerateJsonOptions {
  agentName?: string;

  profile?: ModelProfileId;
  systemPrompt?: string;
  userPrompt: string;

  jsonSchema?: Record<string, unknown>;
  maxOutputTokens?: number;
  temperature?: number;

  forceProvider?: ProviderId;
  forceModel?: string;

  attempts?: number;
}

function makeJsonOnlyGuard(extra?: string): string {
  return [
    "أخرج JSON صالح فقط بدون أي نص إضافي أو Markdown أو كود fences.",
    "إذا كانت هناك مشكلة تمنع الالتزام بالـ JSON، أخرج JSON فارغًا {} بدلًا من أي شرح.",
    extra?.trim() ? `ملاحظة تصحيحية: ${extra.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateJson(opts: GenerateJsonOptions): Promise<unknown> {
  const attempts = opts.attempts ?? 2;

  let system = opts.systemPrompt ?? "";
  let profile = opts.profile;

  if (opts.agentName) {
    const spec = getAgentSpec(opts.agentName);
    if (spec.llmMode === "none") {
      throw new Error(
        `Agent "${opts.agentName}" is llmMode=none; generateJson is not allowed.`
      );
    }
    if (!spec.profile)
      throw new Error(`Agent "${opts.agentName}" has no profile.`);
    profile = spec.profile;

    system = await loadPrompt(spec.promptPath);
  }

  if (!profile)
    throw new Error("Missing profile (either provide agentName or profile).");

  const routed = (() => {
    if (opts.forceProvider && opts.forceModel) {
      return {
        provider: opts.forceProvider,
        model: opts.forceModel,
        params: undefined as Record<string, unknown> | undefined,
      };
    }
    if (opts.forceProvider && !opts.forceModel) {
      const r = routeModel(profile, process.env);
      if (r.provider !== opts.forceProvider) {
        throw new Error(
          "forceProvider requires forceModel to avoid profile mismatch."
        );
      }
      return r;
    }
    return routeModel(profile, process.env);
  })();

  const provider = getProvider(routed.provider);

  let lastErr: string | undefined;

  for (let i = 0; i < attempts; i++) {
    const guard = makeJsonOnlyGuard(lastErr);

    const messages: LlmMessage[] = [
      { role: "system", content: `${system}\n\n${guard}`.trim() },
      { role: "user", content: opts.userPrompt },
    ];

    const resp = await provider.generateText({
      model: opts.forceModel ?? routed.model,
      messages,
      ...(opts.temperature !== undefined && { temperature: opts.temperature }),
      ...(opts.maxOutputTokens !== undefined && {
        maxOutputTokens: opts.maxOutputTokens,
      }),
      ...(opts.jsonSchema !== undefined && { jsonSchema: opts.jsonSchema }),
      ...(routed.params !== undefined && { extra: routed.params }),
    });

    try {
      return parseJsonLoose(resp.text);
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e.message : String(e);
      continue;
    }
  }

  throw new Error(
    `generateJson failed after ${attempts} attempts. Last error: ${lastErr}`
  );
}
