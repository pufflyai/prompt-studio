import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveRuntimeEnvironment } from "./runtime-environment";

const isRunning = (pid: number) => {
  const status = spawnSync("ps", ["-o", "stat=", "-p", String(pid)], { encoding: "utf8" }).stdout.trim();
  // A terminated orphan may briefly remain until the system reaps it.
  return status !== "" && !status.startsWith("Z");
};

for (const shell of ["/bin/bash", "/bin/zsh"]) {
  test.skipIf(process.platform === "win32" || !existsSync(shell))(
    `cancels ${shell} startup and terminates its child`,
    async () => {
      const home = mkdtempSync(join(tmpdir(), "desktop-shell-processes-"));
      const startup =
        'printf "%s" "$$" > "$HOME/shell.pid"\n/bin/sleep 30 &\nprintf "%s" "$!" > "$HOME/child.pid"\nwait\n';
      writeFileSync(join(home, shell.endsWith("bash") ? ".bash_profile" : ".zshrc"), startup);
      const controller = new AbortController();
      const reason = new Error("Runtime startup cancelled");
      const outcome = resolveRuntimeEnvironment(controller.signal, {
        HOME: home,
        ZDOTDIR: home,
        SHELL: shell,
        PATH: "/usr/bin:/bin:/usr/sbin:/sbin",
      }).catch((error) => error);
      const readPids = () =>
        ["shell.pid", "child.pid"]
          .map((name) => {
            const path = join(home, name);
            return existsSync(path) ? Number(readFileSync(path, "utf8")) : 0;
          })
          .filter((pid) => pid > 0);
      let pids: number[] = [];
      try {
        for (let attempt = 0; attempt < 100; attempt++) {
          pids = readPids();
          if (pids.length === 2) break;
          await Bun.sleep(10);
        }
        expect(pids).toHaveLength(2);
        expect(pids.every(isRunning)).toBe(true);
        controller.abort(reason);
        expect(await outcome).toBe(reason);
        // Parent close can precede a killed descendant's final OS exit transition.
        for (let attempt = 0; attempt < 100 && pids.some(isRunning); attempt++) {
          await Bun.sleep(10);
        }
        expect(pids.filter(isRunning)).toEqual([]);
      } finally {
        controller.abort(reason);
        for (const pid of readPids()) {
          try {
            process.kill(pid, "SIGKILL");
          } catch {}
        }
        await outcome;
        rmSync(home, { recursive: true, force: true });
      }
    },
  );
}
