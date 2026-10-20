import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCommand } from "./install-extension-dependencies";

test("drains both output streams across repeated extension commands", async () => {
  const output = "extension λ\n".repeat(8192);
  for (let index = 0; index < 40; index++) {
    const result = await runCommand(
      process.execPath,
      [
        "-e",
        'const output = "extension λ\\n".repeat(8192); process.stdout.write(output); process.stderr.write(output); process.exitCode = 7;',
      ],
      { cwd: process.cwd() },
    );
    expect(result).toEqual({ exitCode: 7, stdout: output, stderr: output });
  }
});

test("cancellation waits for the extension child to exit", async () => {
  const root = mkdtempSync(join(tmpdir(), "extension-command-cancel-"));
  const ready = join(root, "ready");
  const controller = new AbortController();
  const running = runCommand(
    process.execPath,
    [
      "-e",
      `require("node:fs").writeFileSync(${JSON.stringify(ready)}, String(process.pid)); setInterval(() => {}, 1000);`,
    ],
    { cwd: root, signal: controller.signal },
  );
  try {
    while (!existsSync(ready)) await Bun.sleep(0);
    const pid = Number(readFileSync(ready, "utf8"));
    controller.abort();
    expect((await running).exitCode).not.toBe(0);
    expect(() => process.kill(pid, 0)).toThrow();
  } finally {
    controller.abort();
    await running;
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports a command that cannot be started", async () => {
  const result = await runCommand(`missing-extension-command-${crypto.randomUUID()}`, [], { cwd: process.cwd() });
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.length).toBeGreaterThan(0);
});
