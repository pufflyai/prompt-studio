import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, win32 } from "node:path";

const installedPackage = (name: string) => {
  const manifest = createRequire(import.meta.url).resolve("opencode-ai/package.json");
  return createRequire(manifest).resolve(`${name}/package.json`);
};

export const resolveManagedOpencode = (
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
  const report = process.report?.getReport() as { header?: { glibcVersionRuntime?: string } };
  const musl = input.musl ?? (process.platform === "linux" && !report?.header?.glibcVersionRuntime);
  const os = platform === "win32" ? "windows" : platform;
  // The baseline x64 build also supports machines without AVX2.
  const baseline = arch === "x64" ? "-baseline" : "";
  const suffix = platform === "linux" && musl ? "-musl" : "";
  try {
    // Native package paths are upstream implementation details. See ADR 0110.
    const manifest = (input.resolvePackage ?? installedPackage)(`opencode-${os}-${arch}${baseline}${suffix}`);
    const command = join(dirname(manifest), "bin", platform === "win32" ? "opencode.exe" : "opencode");
    return (input.exists ?? existsSync)(command) ? command : null;
  } catch {
    return null;
  }
};

const isPrivateLauncher = (command: string) => {
  try {
    return realpathSync(command) === createRequire(import.meta.url).resolve("opencode-ai/bin/opencode.exe");
  } catch {
    return false;
  }
};

export const resolveOpencodeCommand = (
  input: {
    which?: () => string | null;
    managed?: () => string | null;
    platform?: NodeJS.Platform;
    exists?: (path: string) => boolean;
  } = {},
) => {
  const command = (input.which ?? (() => Bun.which("opencode", { PATH: process.env.PATH })))();
  if (command && (input.platform ?? process.platform) === "win32" && /\.(cmd|bat|ps1)$/i.test(command)) {
    const native = win32.join(win32.dirname(command), "node_modules", "opencode-ai", "bin", "opencode.exe");
    if ((input.exists ?? existsSync)(native)) return native;
    return (input.managed ?? resolveManagedOpencode)() ?? command;
  }
  if (command && !isPrivateLauncher(command)) return command;
  return (input.managed ?? resolveManagedOpencode)() ?? command ?? "opencode";
};
