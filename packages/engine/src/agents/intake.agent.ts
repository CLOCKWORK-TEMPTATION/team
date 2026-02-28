import fs from "node:fs";
import path from "node:path";
import { execa } from "execa";
import type { Agent, AgentContext } from "./types.js";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- فارغ: الاستقبال يعتمد على ctx.repoPath
export interface IntakeInput {}

export interface RepoProfileOutput {
  repoPath: string;
  isGitRepo: boolean;
  gitHead?: string;
  hasUncommittedChanges: boolean;
  packageJsonPaths: string[];
}

export const IntakeAgent: Agent<IntakeInput, RepoProfileOutput> = {
  name: "IntakeAgent",

  async run(ctx: AgentContext): Promise<RepoProfileOutput> {
    const repoPath = ctx.repoPath;

    const isGitRepo = fs.existsSync(path.join(repoPath, ".git"));
    let gitHead: string | undefined;
    let hasUncommittedChanges = false;

    if (isGitRepo) {
      try {
        const head = await execa("git", ["rev-parse", "HEAD"], { cwd: repoPath });
        gitHead = head.stdout.trim();
        const status = await execa("git", ["status", "--porcelain"], { cwd: repoPath });
        hasUncommittedChanges = status.stdout.trim().length > 0;
      } catch {
        // اعتبره git repo لكن لا تعتمد على معلومات إضافية
      }
    }

    // اكتشاف package.json داخل repo (monorepo أو مشروع واحد)
    const packageJsonPaths: string[] = [];
    const walk = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.name === "node_modules" || e.name === ".git" || e.name === "dist" || e.name === "build") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile() && e.name === "package.json") packageJsonPaths.push(p);
      }
    };
    walk(repoPath);

    return {
      repoPath,
      isGitRepo,
      ...(gitHead !== undefined && { gitHead }),
      hasUncommittedChanges,
      packageJsonPaths,
    };
  },
};
