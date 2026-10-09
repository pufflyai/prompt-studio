import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
