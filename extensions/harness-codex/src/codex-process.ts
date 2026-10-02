import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { win32 } from "node:path";
import type { Readable, Writable } from "node:stream";

type SpawnedChild = {
  stdin: Writable;
  stdout: Readable;
  stderr: Readable;
  pid?: number;
  kill(): void;
  onExit: Promise<{ code: number | null; signal: string | null }>;
};

export type SpawnDeps = {
  spawnProcess: (args: string[], options?: { cwd?: string; env?: Record<string, string> }) => SpawnedChild;
};

// On Windows, `npm i -g @openai/codex` only puts a `codex.cmd` shim on PATH.
// This harness pipes stdio for a long-lived JSON protocol, so we want the real
// executable rather than an extra `cmd.exe` layer between us and the process.
// The vendored layout below is best-effort and tracks @openai/codex's current
// packaging; if it moves, we fall back to running the shim through a shell.
const resolveNativeCodex = (command: string, exists: (command: string) => boolean) => {
  if (win32.basename(command).toLowerCase() !== "codex.cmd") return null;

  const npmBinDir = win32.dirname(command);
  const candidates = [
    win32.join(
      npmBinDir,
      "node_modules",
      "@openai",
      "codex",
      "node_modules",
      "@openai",
      "codex-win32-x64",
      "vendor",
      "x86_64-pc-windows-msvc",
      "bin",
      "codex.exe",
    ),
    win32.join(npmBinDir, "node_modules", "@openai", "codex", "vendor", "x86_64-pc-windows-msvc", "bin", "codex.exe"),
  ];

  return candidates.find(exists) ?? null;
};

const isWindowsShim = (command: string) => {
  const lower = command.toLowerCase();
  return lower.endsWith(".cmd") || lower.endsWith(".bat");
};

// `Bun.which` can land on `codex.ps1` when PATHEXT lists `.PS1` before `.CMD`,
// and neither `spawn` nor `cmd.exe` can run a `.ps1`. npm always writes the
// sibling `.cmd`/`.exe` next to it, so switch to that.
const preferSpawnableSibling = (command: string, exists: (command: string) => boolean) => {
  if (!command.toLowerCase().endsWith(".ps1")) return command;

  const base = command.slice(0, -".ps1".length);
  for (const extension of [".cmd", ".bat", ".exe"]) {
    if (exists(base + extension)) return base + extension;
  }
  return command;
};

export const resolveCodexCommand = (
  input: {
    exists?: (command: string) => boolean;
    platform?: NodeJS.Platform | "win32";
    which?: (command: string) => string | null;
  } = {},
) => {
  const platform = input.platform ?? process.platform;
  const which = input.which ?? ((command: string) => (typeof Bun.which === "function" ? Bun.which(command) : null));
  const exists = input.exists ?? existsSync;
  const resolved = which("codex");

  if (platform === "win32" && resolved) {
    const target = preferSpawnableSibling(resolved, exists);
    return resolveNativeCodex(target, exists) ?? target;
  }

  return resolved ?? "codex";
};

export const defaultSpawnProcess = (args: string[], options?: { cwd?: string; env?: Record<string, string> }) => {
  const command = resolveCodexCommand();
  // `child_process.spawn` can't launch a `.cmd`/`.bat` directly on Windows;
  // fall back to a shell only when we couldn't resolve the native binary.
  const useShell = process.platform === "win32" && isWindowsShim(command);
  const child = spawn(command, args, {
    stdio: ["pipe", "pipe", "pipe"],
    cwd: options?.cwd,
    env: { ...process.env, ...options?.env },
    windowsHide: true,
    shell: useShell,
  }) as ChildProcess;

  child.on("error", (err) => {
    console.error("[codex:spawn] child process error:", err);
  });

  const onExit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once("exit", (code, signal) => resolve({ code, signal }));
    child.once("error", () => resolve({ code: 1, signal: null }));
  });

  return {
    stdin: child.stdin!,
    stdout: child.stdout!,
    stderr: child.stderr!,
    pid: child.pid,
    kill: () => child.kill(),
    onExit,
  };
};
