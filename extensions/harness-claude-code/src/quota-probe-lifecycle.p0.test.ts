import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readClaudeUsage } from "./quota-probe";

for (const behavior of ["graceful", "stubborn", ...(process.platform === "win32" ? [] : ["leader-first"])]) {
  test(`quota inspection cleans up a ${behavior} native child behind a launcher`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "claude-quota-tree-"));
    const fixture = join(import.meta.dir, "quota-probe.fixture.ts");
    let command = [process.execPath, fixture, "launcher", directory, behavior];
    if (process.platform === "win32") {
      const launcher = join(directory, "launcher.cmd");
      await writeFile(
        launcher,
        `@echo off\r\n"${process.execPath}" "${fixture}" launcher "${directory}" ${behavior} %*\r\n`,
      );
      command = [launcher];
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        readClaudeUsage(undefined, command),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("Quota cleanup did not finish.")), 1500);
        }),
      ]);
      if (behavior === "leader-first") {
        const pid = readFileSync(join(directory, "native.pid"), "utf8");
        // A killed orphan can remain as a zombie on Linux; it owns no live resources.
        const running = () => {
          const state = spawnSync("ps", ["-o", "stat=", "-p", pid], { encoding: "utf8" }).stdout.trim();
          return state !== "" && !state.startsWith("Z");
        };
        const deadline = Date.now() + 200;
        while (running() && Date.now() < deadline) await Bun.sleep(5);
        expect(running()).toBe(false);
      }
      expect(result.rate_limits).toEqual({ five_hour: { utilization: 25 } });
      if (behavior === "graceful" && process.platform !== "win32")
        expect(readFileSync(join(directory, "terminated"), "utf8")).toBe("native stopped");
    } finally {
      clearTimeout(timer);
      for (const name of ["native", "launcher"]) {
        const path = join(directory, `${name}.pid`);
        if (!existsSync(path)) continue;
        try {
          process.kill(Number(readFileSync(path, "utf8")), "SIGKILL");
        } catch {}
      }
      await rm(directory, { recursive: true, force: true });
    }
  });
}
