import { readFile } from "node:fs/promises";

// Temporary platform probe until Bun exposes the PTY foreground group. See ADR 0033.
// It runs every second for each open terminal, without starting probe subprocesses.
export const readTerminalForeground = async (pid: number) => {
  try {
    if (process.platform === "linux") {
      const stat = await readFile(`/proc/${pid}/stat`, "utf8");
      const fields = stat
        .slice(stat.lastIndexOf(")") + 1)
        .trim()
        .split(/\s+/);
      const group = Number(fields[5]);
      if (group <= 0 || !Number.isInteger(group)) return null;
      return { group, name: (await readFile(`/proc/${group}/comm`, "utf8")).trim() };
    }
    if (process.platform === "darwin") {
      const { readDarwinTerminalForeground } = await import("./terminal-foreground-darwin");
      return readDarwinTerminalForeground(pid);
    }
  } catch {
    return null;
  }
  return null;
};
