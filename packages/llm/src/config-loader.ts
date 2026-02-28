import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ProviderId } from "./providers/types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration types matching config/models.json
 */
export interface ModelConfig {
  provider: ProviderId;
  model: string;
  params?: Record<string, unknown>;
}

export interface ProfileConfig {
  description: string;
  models: ModelConfig[];
}

export interface ModelsConfig {
  profiles: Record<string, ProfileConfig>;
  env_keys: Record<string, string | string[]>;
}

// Cache for loaded configuration
let cachedConfig: ModelsConfig | null = null;
let lastConfigPath: string | null = null;

/**
 * يبحث عن ملف الإعدادات في عدة مواقع محتملة
 */
function findConfigFile(): string | null {
  const possiblePaths = [
    // من جذر المشروع
    path.resolve(__dirname, "../../../config/models.json"),
    // من userData (Electron)
    process.env.REPO_REFACTOR_CONFIG_PATH,
    // مسار نسبي من الحزمة
    path.resolve(__dirname, "../config/models.json"),
  ].filter(Boolean) as string[];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
}

/**
 * يحمّل إعدادات النماذج من ملف JSON
 * يُرجع null إذا لم يوجد ملف الإعدادات
 */
export function loadModelsConfig(): ModelsConfig | null {
  const configPath = findConfigFile();

  if (!configPath) {
    return null;
  }

  // استخدم الكاش إذا لم يتغير المسار
  if (cachedConfig && lastConfigPath === configPath) {
    return cachedConfig;
  }

  try {
    const content = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(content) as ModelsConfig;

    cachedConfig = parsed;
    lastConfigPath = configPath;

    return parsed;
  } catch (error) {
    console.warn(`[config-loader] Failed to load models config from ${configPath}:`, error);
    return null;
  }
}

/**
 * يعيد الإعدادات لـ profile معين
 * يُرجع null إذا لم يُعثر على الـ profile
 */
export function getProfileConfig(profileId: string): ProfileConfig | null {
  const config = loadModelsConfig();
  if (!config) return null;

  return config.profiles[profileId] ?? null;
}

/**
 * يتحقق من توفر مفتاح البيئة للـ provider المحدد
 */
export function isProviderAvailable(
  provider: ProviderId,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const config = loadModelsConfig();

  if (config?.env_keys) {
    const keys = config.env_keys[provider];
    if (Array.isArray(keys)) {
      return keys.every((k) => env[k]);
    }
    if (typeof keys === "string") {
      return !!env[keys];
    }
  }

  // Fallback للتحقق الافتراضي
  switch (provider) {
    case "openai":
      return !!env.OPENAI_API_KEY;
    case "openai_compat":
      return !!(env.OPENAI_COMPAT_BASE_URL && env.OPENAI_COMPAT_API_KEY);
    case "anthropic":
      return !!env.ANTHROPIC_API_KEY;
    case "google":
      return !!env.GOOGLE_API_KEY;
    case "mistral":
      return !!env.MISTRAL_API_KEY;
    default:
      return false;
  }
}

/**
 * يختار أول موديل متاح في الـ profile (من الإعدادات أو الافتراضي)
 */
export function selectModelForProfile(
  profileId: string,
  env: NodeJS.ProcessEnv = process.env
): ModelConfig | null {
  const profile = getProfileConfig(profileId);

  if (profile?.models) {
    for (const model of profile.models) {
      if (isProviderAvailable(model.provider, env)) {
        return model;
      }
    }
  }

  return null;
}

/**
* يُنشئ ملف إعدادات افتراضي في userData
* يُستخدم من Electron لإنشاء الإعدادات الأولية
*/
export function createDefaultConfigFile(userDataPath: string): string {
  const configDir = path.join(userDataPath, "config");
  fs.mkdirSync(configDir, { recursive: true });

  const defaultConfig: ModelsConfig = {
    profiles: {
      PLANNING: {
        description: "Agents that analyze and plan refactoring steps",
        models: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            params: { thinking: "enabled" },
          },
          {
            provider: "openai",
            model: "gpt-4.1",
            params: { reasoning_effort: "high" },
          },
        ],
      },
      CODING: {
        description: "Agents that generate code patches",
        models: [
          {
            provider: "openai",
            model: "gpt-4.1",
            params: { reasoning_effort: "xhigh" },
          },
          {
            provider: "anthropic",
            model: "claude-opus-4-20250514",
            params: { thinking: "enabled" },
          },
        ],
      },
      SUMMARIZE: {
        description: "Agents that summarize and condense information",
        models: [
          {
            provider: "openai",
            model: "gpt-4.1-mini",
            params: { reasoning_effort: "medium" },
          },
        ],
      },
      CONTRACTS_AUGMENT: {
        description: "Agents that extract and augment API contracts",
        models: [
          {
            provider: "openai",
            model: "gpt-4.1-mini",
            params: { reasoning_effort: "medium" },
          },
        ],
      },
      RISK_EXPLAIN: {
        description: "Agents that explain risk assessments",
        models: [
          {
            provider: "openai",
            model: "gpt-4.1-mini",
            params: { reasoning_effort: "medium" },
          },
        ],
      },
    },
    env_keys: {
      openai: "OPENAI_API_KEY",
      openai_compat: ["OPENAI_COMPAT_BASE_URL", "OPENAI_COMPAT_API_KEY"],
      anthropic: "ANTHROPIC_API_KEY",
      google: "GOOGLE_API_KEY",
      mistral: "MISTRAL_API_KEY",
    },
  };

  const configPath = path.join(configDir, "models.json");
  fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), "utf8");

  return configPath;
}
