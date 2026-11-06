import { accessSync, constants, existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import { dirname, join, resolve, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const piBunCommand = (entry: string) => ({
  command: [process.execPath, "--preload", fileURLToPath(new URL("./managed-preload.ts", import.meta.url)), entry],
  env: { BUN_BE_BUN: "1" },
});

const managedPi = () => join(dirname(fileURLToPath(import.meta.resolve("@earendil-works/pi-coding-agent"))), "cli.js");

export const resolvePiCommand = (
  input: {
    which?: () => string | null;
    managed?: () => string;
    platform?: NodeJS.Platform;
    exists?: (path: string) => boolean;
  } = {},
) => {
  const found = (input.which ?? (() => Bun.which("pi")))();
  if (found) {
    if ((input.platform ?? process.platform) === "win32" && /\.(cmd|bat|ps1)$/i.test(found)) {
      const entry = win32.join(
        win32.dirname(found),
        "node_modules",
        "@earendil-works",
        "pi-coding-agent",
        "dist",
        "cli.js",
      );
      if ((input.exists ?? existsSync)(entry)) return piBunCommand(entry);
      return piBunCommand((input.managed ?? managedPi)());
    }
    let entry = found;
    try {
      entry = realpathSync(found);
    } catch {}
    if (/\.[cm]?js$/i.test(entry)) return piBunCommand(entry);
    return { command: [found], env: {} };
  }
  return piBunCommand((input.managed ?? managedPi)());
};

// The bundled CLI prints this same manifest version. Unknown commands still need a real probe.
export const readManagedPiVersion = (
  command: readonly string[],
  env: Record<string, string | undefined>,
  managedEntry?: string,
): string | undefined => {
  if (env.PI_PACKAGE_DIR || env.BUN_BE_BUN !== "1") return undefined;
  try {
    const entry = managedEntry ?? managedPi();
    const expected = piBunCommand(entry).command;
    if (command.length !== expected.length || command.some((part, index) => part !== expected[index])) return undefined;
    accessSync(process.execPath, constants.X_OK);
    accessSync(expected[2]!, constants.R_OK);
    accessSync(entry, constants.R_OK);
    if (!statSync(expected[2]!).isFile() || !statSync(entry).isFile()) return undefined;
    const canonicalEntry = realpathSync(entry);
    // Pi resolves the nearest manifest; a binary-build layout can add one beside the CLI.
    if (existsSync(join(dirname(canonicalEntry), "package.json"))) return undefined;
    const packageRoot = dirname(dirname(canonicalEntry));
    const metadata = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
    if (
      metadata.name !== "@earendil-works/pi-coding-agent" ||
      typeof metadata.bin?.pi !== "string" ||
      realpathSync(resolve(packageRoot, metadata.bin.pi)) !== canonicalEntry ||
      typeof metadata.version !== "string" ||
      !/^\d+\.\d+\.\d+$/.test(metadata.version)
    )
      return undefined;
    return metadata.version;
  } catch {
    return undefined;
  }
};
