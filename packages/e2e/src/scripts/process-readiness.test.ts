import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForProcessReady } from "./process-readiness";
import { runTestCommand } from "./run-test-command";

for (const operation of ["readiness", "command"] as const) {
  test(`${operation} reports root failure while a descendant keeps output pipes open`, async () => {
    const root = mkdtempSync(join(tmpdir(), "inherited-test-output-"));
    const pidPath = join(root, "descendant.pid");
    const source = `
      import {spawn} from "node:child_process";
      import {writeFileSync} from "node:fs";
      const descendant = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {stdio:"inherit"});
      writeFileSync(${JSON.stringify(pidPath)}, String(descendant.pid));
      console.error("parent failed");
      process.exit(7);
    `;
    let pid: number | undefined;
    try {
      const args = ["-e", source];
      let result: Promise<unknown>;
      if (operation === "readiness") {
        const child = spawn(process.execPath, args, { stdio: "pipe" });
        result = waitForProcessReady(child, "Fixture", async () => undefined);
      } else {
        result = runTestCommand(process.execPath, args, {});
      }
      const failure = await result.catch((error: unknown) => error);
      expect(failure).toMatchObject({ message: expect.stringMatching(/code 7[\s\S]*parent failed/) });
      pid = Number(readFileSync(pidPath, "utf8"));
      expect(() => process.kill(pid!, 0)).not.toThrow();
    } finally {
      if (!pid) {
        try {
          pid = Number(readFileSync(pidPath, "utf8"));
        } catch {}
      }
      if (pid) {
        try {
          process.kill(pid);
        } catch {}
      }
      rmSync(root, { recursive: true, force: true });
    }
  });
}
