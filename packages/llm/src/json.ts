function stripCodeFences(s: string): string {
  const trimmed = s.trim();
  if (trimmed.startsWith("```")) {
    const withoutFirst = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n/, "");
    return withoutFirst.replace(/\n```$/, "").trim();
  }
  return trimmed;
}

function findFirstJsonStart(s: string): number {
  const iObj = s.indexOf("{");
  const iArr = s.indexOf("[");
  if (iObj === -1) return iArr;
  if (iArr === -1) return iObj;
  return Math.min(iObj, iArr);
}

function extractBalancedJson(s: string): string | null {
  const start = findFirstJsonStart(s);
  if (start === -1) return null;

  const open = s[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let inStr = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }

    if (ch === '"') {
      inStr = true;
      continue;
    }

    if (ch === open) depth++;
    else if (ch === close) depth--;

    if (depth === 0) {
      return s.slice(start, i + 1);
    }
  }

  return null;
}

export function parseJsonLoose(text: string): unknown {
  const cleaned = stripCodeFences(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    // continue
  }

  const extracted = extractBalancedJson(cleaned);
  if (!extracted) {
    throw new Error("No JSON object/array found in model output.");
  }

  try {
    return JSON.parse(extracted);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid JSON extracted: ${msg}`);
  }
}
