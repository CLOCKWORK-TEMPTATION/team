import crypto from "node:crypto";

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export function generateId(prefix = ""): string {
  return `${prefix}${crypto.randomBytes(8).toString("hex")}`;
}
