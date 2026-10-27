import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, win32 } from "node:path";

const installedPackage = (name: string) => {
  const manifest = createRequire(import.meta.url).resolve("@anthropic-ai/claude-code/package.json");
  return createRequire(manifest).resolve(`${name}/package.json`);
};

export const resolveManagedClaude = (
  input: {
    platform?: NodeJS.Platform;
    arch?: string;
    musl?: boolean;
    resolvePackage?: (name: string) => string;
    exists?: (path: string) => boolean;
  } = {},
) => {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  if (!["darwin", "linux", "win32"].includes(platform) || !["x64", "arm64"].includes(arch)) return null;
  try {
    const musl =
      input.musl ??
      (platform === "linux" &&
        process.platform === "linux" &&
        !(process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined)?.header
          ?.glibcVersionRuntime);
    const suffix = platform === "linux" && musl ? "-musl" : "";
    // Use the shipped native binary because extension installs skip wrapper postinstall scripts (ADR 0110).
    const manifest = (input.resolvePackage ?? installedPackage)(
      `@anthropic-ai/claude-code-${platform}-${arch}${suffix}`,
    );
    const command = join(dirname(manifest), platform === "win32" ? "claude.exe" : "claude");
    return (input.exists ?? existsSync)(command) ? command : null;
  } catch {
    return null;
  }
};

const isPrivateLauncher = (command: string) => {
  try {
    return realpathSync(command) === createRequire(import.meta.url).resolve("@anthropic-ai/claude-code/bin/claude.exe");
  } catch {
    return false;
  }
};

export const resolveClaudeCommand = (
  input: {
    which?: () => string | null;
    managed?: () => string | null;
    platform?: NodeJS.Platform;
    exists?: (path: string) => boolean;
  } = {},
) => {
  const command = (input.which ?? (() => Bun.which("claude", { PATH: process.env.PATH })))();
  if (command && (input.platform ?? process.platform) === "win32" && /\.(cmd|bat|ps1)$/i.test(command)) {
    const native = win32.join(
      win32.dirname(command),
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    );
    if ((input.exists ?? existsSync)(native)) return native;
    return (input.managed ?? resolveManagedClaude)() ?? command;
  }
  if (command && !isPrivateLauncher(command)) return command;
  return (input.managed ?? resolveManagedClaude)() ?? command ?? "claude";
};
