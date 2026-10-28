import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const piBunCommand = (entry: string) => ({
  command: [process.execPath, "--preload", fileURLToPath(new URL("./managed-preload.ts", import.meta.url)), entry],
  env: { BUN_BE_BUN: "1" },
});

let acquiredPackage: string | null = null;
export const setPiPackage = (path: string | null) => {
  acquiredPackage = path;
};
const managedPi = () =>
  acquiredPackage
    ? join(acquiredPackage, "dist", "cli.js")
    : join(dirname(fileURLToPath(import.meta.resolve("@mariozechner/pi-coding-agent"))), "cli.js");
const managedPiCommand = (resolve: () => string | null, fallback: string) => {
  const entry = resolve();
  return entry ? piBunCommand(entry) : { command: [fallback], env: {} };
};

export const resolvePiCommand = (
  input: {
    which?: () => string | null;
    managed?: () => string | null;
    platform?: NodeJS.Platform;
    exists?: (path: string) => boolean;
  } = {},
) => {
  if (acquiredPackage && !input.managed) return piBunCommand(managedPi());
  const found = (input.which ?? (() => Bun.which("pi")))();
  if (found) {
    if ((input.platform ?? process.platform) === "win32" && /\.(cmd|bat|ps1)$/i.test(found)) {
      const entry = ["@earendil-works", "@mariozechner"]
        .map((scope) => win32.join(win32.dirname(found), "node_modules", scope, "pi-coding-agent", "dist", "cli.js"))
        .find(input.exists ?? existsSync);
      if (entry) return piBunCommand(entry);
      return managedPiCommand(input.managed ?? managedPi, found);
    }
    let entry = found;
    try {
      entry = realpathSync(found);
    } catch {}
    if (/\.[cm]?js$/i.test(entry)) return piBunCommand(entry);
    return { command: [found], env: {} };
  }
  return managedPiCommand(input.managed ?? managedPi, "pi");
};

export const resolvePiModule = () => {
  const command = resolvePiCommand().command.at(-1)!;
  const entry = realpathSync(command);
  const packagePath = acquiredPackage ?? dirname(dirname(entry));
  const manifestPath = join(packagePath, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (!["@mariozechner/pi-coding-agent", "@earendil-works/pi-coding-agent"].includes(manifest.name))
    throw new Error("The global Pi package could not be found.");
  if (typeof manifest.main !== "string") throw new Error("The Pi package has no module entry.");
  return pathToFileURL(join(packagePath, manifest.main)).href;
};
