import { execaCommand } from "execa";
import { logger } from "@pkg/shared";

export interface KnipResult {
  unusedFiles: string[];
  unusedExports: Array<{ file: string; symbol: string }>;
  unusedDependencies: string[];
  rawOutput: string;
}

export async function runKnip(repoPath: string): Promise<KnipResult> {
  const result: KnipResult = { unusedFiles: [], unusedExports: [], unusedDependencies: [], rawOutput: "" };

  try {
    const { stdout, stderr } = await execaCommand(
      `npx knip --reporter json --no-progress`,
      { reject: false, timeout: 180_000, cwd: repoPath }
    );

    const output = stdout || stderr || "";
    result.rawOutput = output;

    if (!output.trim()) return result;

    const firstBrace = output.indexOf("{");
    const lastBrace = output.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace === -1) return result;

    const parsed = JSON.parse(output.substring(firstBrace, lastBrace + 1)) as {
      files?: string[];
      exports?: Array<{ file: string; symbol: string }>;
      dependencies?: string[];
      [key: string]: unknown;
    };

    result.unusedFiles = parsed.files ?? [];

    if (Array.isArray(parsed.exports)) {
      result.unusedExports = parsed.exports.map(e => ({
        file: typeof e === "string" ? e : e.file ?? "",
        symbol: typeof e === "string" ? "" : e.symbol ?? "",
      }));
    }

    result.unusedDependencies = parsed.dependencies ?? [];
  } catch (err) {
    logger.warn({ err }, "knip run failed — continuing without knip data");
  }

  return result;
}
