import { execa, type Options as ExecaOptions } from "execa";

export async function runCommand(
  command: string,
  args: string[],
  options?: ExecaOptions
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr, exitCode } = await execa(command, args, options);
    return { 
      stdout: stdout ? String(stdout) : "", 
      stderr: stderr ? String(stderr) : "", 
      exitCode: exitCode ?? 0 
    };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string; exitCode?: number };
    return {
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? err.message ?? "",
      exitCode: err.exitCode ?? 1,
    };
  }
}
