import { existsSync, realpathSync } from "node:fs";
import { dirname, join, win32 } from "node:path";
import { fileURLToPath } from "node:url";

export const piBunCommand = (entry: string) => ({
  command: [process.execPath, "--preload", fileURLToPath(new URL("./managed-preload.ts", import.meta.url)), entry],
  env: { BUN_BE_BUN: "1" },
});

const managedPi = () => join(dirname(fileURLToPath(import.meta.resolve("@mariozechner/pi-coding-agent"))), "cli.js");

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
      const entry = ["@earendil-works", "@mariozechner"]
        .map((scope) => win32.join(win32.dirname(found), "node_modules", scope, "pi-coding-agent", "dist", "cli.js"))
        .find(input.exists ?? existsSync);
      if (entry) return piBunCommand(entry);
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
