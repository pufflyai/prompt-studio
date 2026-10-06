import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const runPs = async (args: string[]) => {
  const child = Bun.spawn(["/bin/ps", ...args], { stdout: "pipe", stderr: "ignore" });
  const [output, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  return { output: output.trim(), exitCode };
};

// Temporary platform probe until Bun exposes the PTY foreground group. See ADR 0033.
// It runs every second for each open terminal, so it stays async to keep the API event loop free.
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
      const tpgid = await runPs(["-o", "tpgid=", "-p", String(pid)]);
      const group = Number(tpgid.output);
      if (tpgid.exitCode !== 0 || group <= 0 || !Number.isInteger(group)) return null;
      const name = await runPs(["-o", "comm=", "-p", String(group)]);
      return { group, name: basename(name.output) };
    }
  } catch {
    return null;
  }
  return null;
};
