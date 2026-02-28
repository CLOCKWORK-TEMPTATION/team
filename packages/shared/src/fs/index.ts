import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import ignoreModule from "ignore";

interface IgnoreInstance {
  add: (p: string[]) => IgnoreInstance;
  ignores: (p: string) => boolean;
}
const getIgnore = (): IgnoreInstance => {
  const fn = (ignoreModule as unknown as { default?: () => IgnoreInstance }).default ?? (ignoreModule as unknown as () => IgnoreInstance);
  return fn();
};

export async function readTextFile(filePath: string): Promise<string> {
  return fs.readFile(filePath, "utf-8");
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findFiles(
  cwd: string,
  patterns: string[],
  ignorePatterns: string[] = []
): Promise<string[]> {
  const ig = getIgnore().add(ignorePatterns);
  const files = await fg(patterns, {
    cwd,
    absolute: false,
    dot: true,
  });
  return files.filter((f) => !ig.ignores(f));
}
