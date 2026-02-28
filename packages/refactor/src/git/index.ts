import { runCommand } from "@pkg/shared";

export async function createBranch(repoPath: string, branchName: string) {
  await runCommand("git", ["checkout", "-b", branchName], { cwd: repoPath });
}

export async function commitChanges(repoPath: string, message: string) {
  await runCommand("git", ["add", "."], { cwd: repoPath });
  await runCommand("git", ["commit", "-m", message], { cwd: repoPath });
}

export async function revertCommit(repoPath: string, commitHash = "HEAD") {
  await runCommand("git", ["revert", "--no-edit", commitHash], { cwd: repoPath });
}
