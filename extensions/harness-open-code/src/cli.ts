import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, win32 } from "node:path";

const wrapperManifest = () => {
  // A provision hook can load the worker before its private node_modules is linked.
  // Bun caches that missing directory for package resolution. Resolve the manifest by path.
  try {
    return realpathSync(new URL("../node_modules/@opencode/cli/package.json", import.meta.url));
  } catch {
    return createRequire(import.meta.url).resolve("@opencode/cli/package.json");
  }
};

const installedPackage = (name: string) => createRequire(wrapperManifest()).resolve(`${name}/package.json`);

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
  try {
    const musl =
      input.musl ??
      (platform === "linux" &&
        process.platform === "linux" &&
        !(process.report?.getReport() as { header?: { glibcVersionRuntime?: string } } | undefined)?.header
          ?.glibcVersionRuntime);
    const os = platform === "win32" ? "windows" : platform;
    // The baseline x64 build also supports machines without AVX2.
    const baseline = arch === "x64" ? "-baseline" : "";
    const suffix = platform === "linux" && musl ? "-musl" : "";
    // Native package paths are upstream implementation details. See ADR 0110.
    const manifest = (input.resolvePackage ?? installedPackage)(`@opencode/cli-${os}-${arch}${baseline}${suffix}`);
    const command = join(dirname(manifest), "bin", platform === "win32" ? "opencode.exe" : "opencode");
    return (input.exists ?? existsSync)(command) ? command : null;
  } catch {
    return null;
  }
};

const isPrivateLauncher = (command: string) => {
  try {
    return realpathSync(command) === realpathSync(join(dirname(wrapperManifest()), "bin", "opencode.exe"));
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
    const native = win32.join(win32.dirname(command), "node_modules", "@opencode", "cli", "bin", "opencode.exe");
    if ((input.exists ?? existsSync)(native)) return native;
    return (input.managed ?? resolveManagedOpencode)() ?? command;
  }
  if (command && !isPrivateLauncher(command)) return command;
  return (input.managed ?? resolveManagedOpencode)() ?? command ?? "opencode";
};
