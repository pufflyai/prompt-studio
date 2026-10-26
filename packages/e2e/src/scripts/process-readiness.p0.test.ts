import { expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { waitForProcessReady } from "./process-readiness";
import { runTestCommand } from "./run-test-command";

test("ready processes can finish writing output after readiness returns", async () => {
  const child = spawn(
    process.execPath,
    [
      "-e",
      `import {writeSync} from "node:fs";
       process.stdin.once("data", () => {
         const chunk = Buffer.alloc(1024 * 1024, ".");
         for (const fd of [1, 2]) for (let index = 0; index < 8; index++) writeSync(fd, chunk);
         process.exit(0);
       });`,
    ],
    { stdio: "pipe" },
  );
  try {
    const exited = once(child, "exit");
    expect(await waitForProcessReady(child, "Fixture", async () => true)).toBe(true);
    child.stdin!.end("write");
    expect((await exited)[0]).toBe(0);
  } finally {
    if (child.exitCode === null) child.kill();
  }
});

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
