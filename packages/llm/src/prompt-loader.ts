import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cache = new Map<string, string>();

async function readTextCached(absPath: string): Promise<string> {
  const hit = cache.get(absPath);
  if (hit != null) return hit;
  const txt = await fs.readFile(absPath, "utf8");
  cache.set(absPath, txt);
  return txt;
}

export interface PromptRenderOptions {
  /**
   * استبدالات إضافية: {{KEY}} => value
   */
  vars?: Record<string, string>;
}

export async function loadBaseSystemPrompt(): Promise<string> {
  const abs = path.resolve(__dirname, "prompts/_base_system.md");
  return await readTextCached(abs);
}

export async function loadPrompt(
  relPathFromLlmSrc: string,
  opts?: PromptRenderOptions
): Promise<string> {
  const abs = path.resolve(__dirname, relPathFromLlmSrc);
  let txt = await readTextCached(abs);

  if (txt.includes("{{_base_system}}")) {
    const base = await loadBaseSystemPrompt();
    txt = txt.replaceAll("{{_base_system}}", base.trim());
  }

  if (opts?.vars) {
    for (const [k, v] of Object.entries(opts.vars)) {
      txt = txt.replaceAll(`{{${k}}}`, v);
    }
  }

  return txt.trim();
}
