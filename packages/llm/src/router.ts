import {
  MODEL_PROFILES,
  type ModelProfileId,
  type ProviderModelChoice,
} from "./profiles.js";
import type { ProviderId } from "./providers/types.js";
import { AGENT_LLM_SPECS } from "./agent-mapping.js";
import { loadPrompt } from "./prompt-loader.js";
import {
  selectModelForProfile,
  isProviderAvailable,
} from "./config-loader.js";
import { OpenAIProvider } from "./providers/openai.js";
import { OpenAICompatProvider } from "./providers/openai-compatible.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GoogleProvider } from "./providers/google.js";
import { MistralProvider } from "./providers/mistral.js";

export interface RoutedModel {
  provider: ProviderModelChoice["provider"];
  model: string;
  params?: Record<string, unknown>;
}

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

export function getAgentSpec(agentName: string) {
  const spec = AGENT_LLM_SPECS.find((s) => s.agentName === agentName);
  if (!spec) throw new Error(`Unknown agent: ${agentName}`);
  return spec;
}

/**
 * يختار أول موديل متاح (حسب توفر مفاتيح API في env)
 * يتحقق أولاً من ملف الإعدادات، ثم يرجع للإعدادات الافتراضية
 */
export function routeModel(
  profile: ModelProfileId,
  env: NodeJS.ProcessEnv = process.env
): RoutedModel {
  // محاولة استخدام الإعدادات من ملف JSON
  const configModel = selectModelForProfile(profile, env);
  if (configModel) {
    const result: RoutedModel = {
      provider: configModel.provider,
      model: configModel.model,
    };
    if (configModel.params) {
      result.params = configModel.params;
    }
    return result;
  }

  // Fallback للإعدادات الافتراضية (hardcoded)
  const choices = MODEL_PROFILES[profile];
  for (const c of choices) {
    const base = { provider: c.provider, model: c.model };
    if (isProviderAvailable(c.provider, env)) {
      return c.params ? { ...base, params: c.params } : base;
    }
  }

  throw new Error(`No provider keys available for profile=${profile}`);
}

/**
 * يستدعي LLM للوكيل المحدد عبر واجهة LlmProvider الموحدة.
 */
export async function invokeAgent(
  agentName: string,
  userContent: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<string> {
  const spec = getAgentSpec(agentName);
  if (spec.llmMode === "none") {
    throw new Error(`Agent ${agentName} is Tool-Only (llmMode=none)`);
  }
  if (!spec.profile) {
    throw new Error(`Agent ${agentName} has no profile`);
  }

  const routed = routeModel(spec.profile, env);
  const systemPrompt = await loadPrompt(spec.promptPath);

  const provider = getProvider(routed.provider);
  const req: Parameters<typeof provider.generateText>[0] = {
    model: routed.model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  };
  if (routed.params !== undefined) req.extra = routed.params;
  const resp = await provider.generateText(req);

  return resp.text;
}

/** @deprecated Use invokeAgent("RefactorPlannerReportAgent", ...) — محفوظ للتوافق */
export async function askPlanner(findingsSummary: string): Promise<string> {
  return await invokeAgent(
    "RefactorPlannerReportAgent",
    `Here are the Findings summary in JSON format:\n${findingsSummary}\n\nGenerate the steps JSON array now:`
  );
}

/** @deprecated Use invokeAgent("PatchAuthor", ...) — محفوظ للتوافق */
export async function askPatchAuthor(task: string): Promise<string> {
  return invokeAgent(
    "PatchAuthor",
    `Write code for this task:\n\n${task}`
  );
}
