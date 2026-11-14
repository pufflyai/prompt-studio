import { execFile } from "node:child_process";
import { promisify } from "node:util";

/** Enumerate real descendants; window/page counts do not describe Electron's process tree. */
export const ownedProcesses = async (roots: number[]) => {
  const command = process.platform === "win32" ? "powershell.exe" : "ps";
  const args =
    process.platform === "win32"
      ? [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          "Get-CimInstance Win32_Process | ForEach-Object { '{0} {1}' -f $_.ProcessId,$_.ParentProcessId }",
        ]
      : ["-axo", "pid=,ppid="];
  const { stdout } = await promisify(execFile)(command, args);
  const rows = stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number));
  if (!rows.length || rows.some((row) => row.length !== 2 || row.some((value) => !Number.isInteger(value))))
    throw new Error("Missing native process enumeration");
  const live = new Set(rows.map(([pid]) => pid!));
  const owned = new Set(roots.filter((pid) => live.has(pid)));
  let changed = true;
  while (changed) {
    changed = false;
    for (const [pid, parent] of rows)
      if (owned.has(parent!) && !owned.has(pid!)) {
        owned.add(pid!);
        changed = true;
      }
  }
  if (roots.some((pid) => !owned.has(pid))) throw new Error("An app-owned root is missing");
  return [...owned];
};
