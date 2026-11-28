import { existsSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const wrapperManifest = () => {
  // A provision hook can load the worker before its private node_modules is linked.
  // Bun caches that missing directory for package resolution. Resolve the manifest by path.
  try {
    return realpathSync(new URL("../node_modules/@openai/codex/package.json", import.meta.url));
  } catch {
    return createRequire(import.meta.url).resolve("@openai/codex/package.json");
  }
};

const installedPackage = (name: string) => createRequire(wrapperManifest()).resolve(`${name}/package.json`);

export const isPrivateCodexLauncher = (command: string) => {
  try {
    return realpathSync(command) === realpathSync(join(dirname(wrapperManifest()), "bin", "codex.js"));
  } catch {
    return false;
  }
};

export const resolveManagedCodex = (
  input: {
    platform?: NodeJS.Platform;
    arch?: string;
    resolvePackage?: (name: string) => string;
    exists?: (path: string) => boolean;
  } = {},
) => {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const cpus: Partial<Record<string, string>> = { x64: "x86_64", arm64: "aarch64" };
  const cpu = cpus[arch];
  const operatingSystems: Partial<Record<NodeJS.Platform, string>> = {
    darwin: "apple-darwin",
    linux: "unknown-linux-musl",
    win32: "pc-windows-msvc",
  };
  const os = operatingSystems[platform];
  if (!cpu || !os) return null;
  try {
    // Native package paths are upstream implementation details. See ADR 0110.
    const manifest = (input.resolvePackage ?? installedPackage)(`@openai/codex-${platform}-${arch}`);
    const command = join(
      dirname(manifest),
      "vendor",
      `${cpu}-${os}`,
      "bin",
      platform === "win32" ? "codex.exe" : "codex",
    );
    return (input.exists ?? existsSync)(command) ? command : null;
  } catch {
    return null;
  }
};
