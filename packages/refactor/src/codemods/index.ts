import type { Project } from "ts-morph";

export function renameSymbol(project: Project, filePath: string, oldName: string, newName: string) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) return false;

  const decl = sourceFile.getExportedDeclarations().get(oldName)?.[0];
  if (!decl) return false;

  if ('rename' in decl) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    (decl as any).rename(newName);
    return true;
  }
  return false;
}
