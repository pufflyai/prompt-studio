import { readFileSync } from "node:fs";
import { basename } from "node:path";

const shells = new Set(["sh", "bash", "zsh", "fish", "dash", "ksh", "csh", "tcsh"]);

export const isInteractiveShell = (command: string[]) =>
  shells.has(basename(command[0])) &&
  command.slice(1).every((arg) => arg.startsWith("-") && !/^-[^-]*c/.test(arg) && arg !== "--command");

export const isShellAtPrompt = (pid: number) => {
  const foreground = readTerminalForeground(pid);
  return foreground?.group === pid && shells.has(foreground.name.replace(/^-/, ""));
};

// Temporary platform probe until Bun exposes the PTY foreground group. See ADR 0031.
export const readTerminalForeground = (pid: number) => {
  try {
    if (process.platform === "linux") {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const fields = stat
        .slice(stat.lastIndexOf(")") + 1)
        .trim()
        .split(/\s+/);
      const group = Number(fields[5]);
      if (group <= 0 || !Number.isInteger(group)) return null;
      return { group, name: readFileSync(`/proc/${group}/comm`, "utf8").trim() };
    }
    if (process.platform === "darwin") {
      const result = Bun.spawnSync(["/bin/ps", "-o", "tpgid=", "-p", String(pid)]);
      const group = Number(result.stdout.toString().trim());
      if (result.exitCode !== 0 || group <= 0 || !Number.isInteger(group)) return null;
      const name = Bun.spawnSync(["/bin/ps", "-o", "comm=", "-p", String(group)])
        .stdout.toString()
        .trim();
      return { group, name: basename(name) };
    }
  } catch {
    return null;
  }
  return null;
};
