import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import cmdShim from "cmd-shim";
import { createProcessApi } from "./extension-process-api";
import { resolveProcessCommand } from "./process-command";

const run = async (command: readonly string[], prefix: string) => {
  const resolved = resolveProcessCommand(command, (name) => Bun.which(name, { PATH: prefix }));
  // Bun.which reads the startup PATH. Route this call to the isolated fixture
  // while retaining the process API's environment, spawning and output handling.
  const api = createProcessApi({
    spawner: ((_command, options) =>
      Bun.spawn(resolved.argv, {
        ...options,
        windowsVerbatimArguments: resolved.windowsVerbatimArguments,
      })) as typeof Bun.spawn,
  });
  const { stdout, stderr, exitCode } = await api.run({ command: [...command] });
  return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
};

for (const directory of ["user", "User Name & Tools"]) {
  test.skipIf(process.platform !== "win32")(`runs npm OpenCode commands from ${directory}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "opencode-npm-"));
    const prefix = join(root, directory, "AppData", "Roaming", "npm");
    const bin = join(prefix, "node_modules", "opencode-ai", "bin");
    mkdirSync(bin, { recursive: true });
    writeFileSync(
      join(bin, "opencode.cjs"),
      'console.log(process.argv[2] === "--version" ? "1.18.34" : JSON.stringify(process.argv.slice(2)));',
    );
    // npm command shims pass their arguments through a second cmd.exe parse.
    writeFileSync(
      join(prefix, "opencode.cmd"),
      `@ECHO off\r\n"${process.execPath}" "%~dp0\\node_modules\\opencode-ai\\bin\\opencode.cjs" %*\r\n`,
    );
    writeFileSync(join(prefix, "opencode.ps1"), 'throw "Use the sibling command shim"');
    writeFileSync(join(prefix, "opencode"), "#!/bin/sh\nexit 1\n");
    try {
      expect(await run(["opencode", "--version"], prefix)).toEqual({
        exitCode: 0,
        stdout: "1.18.34",
        stderr: "",
      });
      expect(await run(["opencode", "models", "--verbose"], prefix)).toEqual({
        exitCode: 0,
        stdout: '["models","--verbose"]',
        stderr: "",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test.skipIf(process.platform !== "win32")(
  "keeps npm shim arguments intact without running shell operators",
  async () => {
    const root = mkdtempSync(join(tmpdir(), "npm-command-"));
    const prefix = join(root, "npm");
    mkdirSync(prefix);
    writeFileSync(join(prefix, "probe.cjs"), "console.log(JSON.stringify(process.argv.slice(2)));");
    writeFileSync(join(prefix, "probe.cmd"), `@ECHO off\r\n"${process.execPath}" "%~dp0\\probe.cjs" %*\r\n`);
    const args = ["a & b", "x|y", "(value)", "a^b", 'say "hello"', "C:\\folder with spaces\\"];

    try {
      expect(await run(["probe", ...args], prefix)).toEqual({
        exitCode: 0,
        stdout: JSON.stringify(args),
        stderr: "",
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
);

const roots: string[] = [];
afterEach(async () => {
  // Apply ADR 0039's asynchronous cleanup policy while Windows releases executable handles.
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

const fixture = (directory: string, name = "node") => {
  // Child processes report resolved paths, so compare against the resolved temp folder.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "process-command-")));
  roots.push(root);
  const prefix = join(root, directory);
  const bin = join(prefix, "node_modules", "fixture");
  mkdirSync(bin, { recursive: true });
  const script = join(bin, `${name}.cjs`);
  writeFileSync(script, "console.log('fixture')");
  const command = join(prefix, `${name}.cmd`);
  writeFileSync(command, `@echo off\r\n"${process.execPath}" "%~dp0\\node_modules\\fixture\\${name}.cjs" %*\r\n`);
  return { prefix, command, script };
};

test.skipIf(process.platform !== "win32")(
  "reports npm wrappers broken by an ampersand in their install path",
  async () => {
    const { command, script } = fixture("npm & tools", "discovery-cli");
    writeFileSync(script, "#!/usr/bin/env node\nconsole.log('fixture')");
    await cmdShim(script, command.replace(/\.cmd$/, ""));
    // cmd-shim 7 assigns %~dp0 without quotes. Run it directly to establish that
    // this installation is broken even outside the extension process launcher.
    const child = Bun.spawn([process.env.ComSpec ?? "cmd.exe", "/d", "/s", "/c", `""${command}" --version"`], {
      stdout: "pipe",
      stderr: "pipe",
      windowsVerbatimArguments: true,
    });
    const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain("MODULE_NOT_FOUND");
    const result = await createProcessApi().run({ command: [command, "--version"] });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("MODULE_NOT_FOUND");
  },
);

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
  const started = join(prefix, "started");
  writeFileSync(
    script,
    `[System.IO.File]::WriteAllText([System.IO.Path]::Combine($PSScriptRoot, 'started'), 'started')\nWrite-Output "1.2.3"`,
  );
  const startedAt = performance.now();
  try {
    const result = await createProcessApi().run({ command: [script], timeoutMs: 10_000 });
    expect(result.exitCode, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe("1.2.3");
  } finally {
    console.error(
      `[PowerShell probe] elapsed=${Math.round(performance.now() - startedAt)}ms scriptStarted=${existsSync(started)}`,
    );
  }
});
