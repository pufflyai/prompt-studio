import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { priorityFromFile, testRunner } from "./test-discovery";

export const nativeSourceGroups = ["process-security", "filesystem-storage"] as const;
export const windowsSourceContract = (file: string, root = resolve(import.meta.dir, "../..")) => {
  if (file.startsWith("packages/e2e/") || file.startsWith("scripts/")) return;
  if (!priorityFromFile(file) || priorityFromFile(file) === "P3" || !["bun", "api"].includes(testRunner(file))) return;
  if (/pglite-(lock|current-home)|rename-pglite-home|file-watch|watcher|symlink/.test(file))
    return { group: "filesystem-storage", reason: "Native filesystem watching, locking, rename and cleanup" };
  if (
    /windows|win32|process-command|process-tree|terminal-interrupt|performance-endpoint|shell-environment|credential/.test(
      file,
    )
  )
    return { group: "process-security", reason: "Windows process, shell, credential or permission boundary" };
  if (!existsSync(join(root, file))) return;
  const source = readFileSync(join(root, file), "utf8");
  if (/Windows|ConPTY|PowerShell|\bPTY\b|setRawMode|Bun\.spawn|spawnSync|execFileSync/.test(source))
    return {
      group: "process-security",
      reason: "Retain native process and terminal assertions, including helper-driven cases",
    };
  if (/node:fs|symlink|chmod|rename|watchFile|fs\.watch/.test(source))
    return {
      group: "filesystem-storage",
      reason: "Retain mixed native filesystem assertions until their cases are audited",
    };
  if (/process\.platform\s*[!=]==?\s*["']win32|["']win32["']\s*[!=]==?\s*process\.platform/.test(source))
    return { group: "process-security", reason: "Retain existing Windows-specific assertions until split" };
};

export const selectWindowsSourceContracts = (files: string[], group: string) =>
  files.filter((file) => windowsSourceContract(file)?.group === group);
