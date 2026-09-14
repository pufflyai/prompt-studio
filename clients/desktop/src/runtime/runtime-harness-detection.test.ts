import { expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { DesktopRuntimeManager } from "./runtime-manager";

test.skipIf(process.platform === "win32")("detects shell-installed harnesses after a desktop launch", async () => {
  const home = mkdtempSync(join(tmpdir(), "desktop-harness-path-"));
  const toolsPath = join(home, "agent tools");
  mkdirSync(toolsPath);
  writeFileSync(join(toolsPath, "harness-probe"), `#!${process.execPath}\nconsole.log("harness-probe 1.0");\n`, {
    mode: 0o755,
  });
  writeFileSync(join(home, ".bash_profile"), 'source "$HOME/.bashrc"\n');
  writeFileSync(
    join(home, ".bashrc"),
    'case $- in *i*) ;; *) return ;; esac\necho "Shell startup output"\nexport PATH="$HOME/agent tools:$PATH"\nexport PSTDIO_HOME="$HOME/wrong-runtime"\n',
  );
  const originalEnv = { ...process.env };
  process.env.HOME = home;
  process.env.SHELL = "/bin/bash";
  process.env.PATH = "/usr/bin:/bin:/usr/sbin:/sbin";
  process.env.PSTDIO_HOME = join(home, "runtime");
  const descriptor = {
    schemaVersion: 1 as const,
    protocolVersion: 1 as const,
    pid: process.pid,
    instanceId: "harness-runtime",
    ownerType: "desktop" as const,
    origin: "http://127.0.0.1:43127" as const,
    token: "test-token",
    appVersion: "0.33.1",
    startedAt: new Date().toISOString(),
  };
  const discoveries = [{ state: "missing" as const }, { state: "healthy" as const, descriptor }];
  let probeOutput = "";
  let runtimeHome: string | undefined;
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: () => true,
  });
  const manager = new DesktopRuntimeManager(
    {
      descriptorPath: join(home, "runtime.json"),
      resolveSidecarPath: () => "/app/pstdio",
      onIntentionalShutdown() {},
      onUnexpectedExit() {},
      onPhase() {},
    },
    {
      createInstanceId: () => descriptor.instanceId,
      discoverRuntime: async () => discoveries.shift()!,
      existsSync: () => true,
      observeRuntimeShutdown: async () => {},
      spawn: (_path, _args, options) => {
        runtimeHome = options.env.PSTDIO_HOME;
        const probe = spawnSync("harness-probe", [], { env: options.env, encoding: "utf8" });
        probeOutput = probe.error?.message ?? probe.stdout.trim();
        return child;
      },
    },
  );

  try {
    await manager.start();
    expect(probeOutput).toBe("harness-probe 1.0");
    expect(runtimeHome).toBe(join(home, "runtime"));
  } finally {
    manager.detach();
    for (const name of ["HOME", "SHELL", "PATH", "PSTDIO_HOME"]) {
      if (originalEnv[name] === undefined) delete process.env[name];
      else process.env[name] = originalEnv[name];
    }
    rmSync(home, { recursive: true, force: true });
  }
});
