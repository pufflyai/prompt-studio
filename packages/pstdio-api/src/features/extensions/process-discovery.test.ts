import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { createProcessApi } from "./extension-process-api";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const fixture = (directory: string, name = "node", source = "console.log('fixture')") => {
  const root = mkdtempSync(join(tmpdir(), "process-discovery-"));
  roots.push(root);
  const prefix = join(root, directory);
  mkdirSync(prefix, { recursive: true });
  const bin = join(prefix, "node_modules", "fixture");
  mkdirSync(bin, { recursive: true });
  const script = join(bin, `${name}.cjs`);
  writeFileSync(script, source);
  const command = join(prefix, name + (process.platform === "win32" ? ".cmd" : ""));
  writeFileSync(
    command,
    process.platform === "win32"
      ? `@echo off\r\n"${process.execPath}" "%~dp0\\node_modules\\fixture\\${name}.cjs" %*\r\n`
      : `#!/bin/sh\nexec '${process.execPath}' '${script}' "$@"\n`,
    { mode: 0o755 },
  );
  return { prefix, command, script };
};

test("uses the per-call PATH for lookup as well as child execution", async () => {
  const { prefix } = fixture("custom tools");
  const result = await createProcessApi().run({ command: ["node", "--version"], env: { PATH: prefix } });
  expect(result).toEqual({ exitCode: 0, stdout: "fixture\n", stderr: "" });
});

test("preserves PATH order and does not silently bypass a broken installation", async () => {
  const first = fixture("first", "discovery-cli", "console.error('broken install'); process.exit(7)");
  const second = fixture("second", "discovery-cli");
  const api = createProcessApi();
  const run = (paths: string[]) => api.run({ command: ["discovery-cli"], env: { PATH: paths.join(delimiter) } });
  expect(await run([first.prefix, second.prefix])).toEqual({ exitCode: 7, stdout: "", stderr: "broken install\n" });
  expect((await run([second.prefix, first.prefix])).stdout).toBe("fixture\n");
});

for (const directory of ["npm", "Custom Tools Å & Partners"]) {
  test(`runs explicit wrapper paths and keeps arguments intact in ${directory}`, async () => {
    const { command } = fixture(directory, "discovery-cli", "console.log(JSON.stringify(process.argv.slice(2)))");
    const args = ["a & b", "x|y", "(value)", "a^b", 'say "hello"', "C:\\folder with spaces\\", "Ångström"];
    const result = await createProcessApi().run({ command: [command, ...args] });
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(args);
  });
}

test("reports missing wrapper targets as failures", async () => {
  const { command, script } = fixture("custom");
  rmSync(script);
  expect((await createProcessApi().run({ command: [command] })).exitCode).not.toBe(0);
});

test("closes stdin for one-shot probes", async () => {
  const { command } = fixture(
    "custom",
    "input-cli",
    "process.stdin.resume(); process.stdin.on('end', () => console.log('finished'));",
  );
  expect((await createProcessApi().run({ command: [command], timeoutMs: 1500 })).stdout.trim()).toBe("finished");
});

test.skipIf(process.platform !== "win32")(
  "honors per-call PATHEXT and prefers a runnable PowerShell sibling",
  async () => {
    const { prefix, command } = fixture("custom", "discovery-cli");
    writeFileSync(join(prefix, "discovery-cli.bat"), "@echo batch\r\n");
    writeFileSync(join(prefix, "discovery-cli.ps1"), 'throw "Use the sibling wrapper"');
    const api = createProcessApi();
    const run = (PATHEXT: string) => api.run({ command: ["discovery-cli"], env: { PATH: prefix, PATHEXT } });
    expect((await run(".BAT;.CMD")).stdout.trim()).toBe("batch");
    expect((await run(".PS1;.CMD;.BAT")).stdout.trim()).toBe("fixture");
    expect((await api.run({ command: [command.replace(/\.cmd$/, ".ps1")] })).stdout.trim()).toBe("fixture");
  },
);

test.skipIf(process.platform !== "win32")("runs a standalone PowerShell script", async () => {
  const { prefix } = fixture("PowerShell Å tools");
  const script = join(prefix, "only.ps1");
  writeFileSync(script, 'Write-Output "1.2.3"');
  const result = await createProcessApi().run({ command: [script], timeoutMs: 3000 });
  expect(result.exitCode, result.stderr).toBe(0);
  expect(result.stdout.trim()).toBe("1.2.3");
});

test("stops a timed-out wrapper and the child it started", async () => {
  const { command, prefix, script } = fixture("npm", "hanging-cli");
  const pidFile = join(prefix, "child.pid");
  writeFileSync(
    script,
    `require('node:fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`,
  );
  // Reading the PID file below proves the wrapper started its child before the
  // deadline, so slow startup cannot make this test pass without testing cleanup.
  const running = createProcessApi().run({ command: [command], timeoutMs: 1500 });
  await expect(running).rejects.toThrow("timed out");
  const pid = Number(await Bun.file(pidFile).text());
  let alive = true;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      process.kill(pid, 0);
    } catch {
      alive = false;
      break;
    }
    await Bun.sleep(20);
  }
  if (alive) process.kill(pid, "SIGKILL");
  expect(alive).toBe(false);
});
