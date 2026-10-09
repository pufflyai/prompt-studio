import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { smokeBrowserInstallDirectory, smokePlaywrightVersion } from "./smoke-browser-package";

const runBundledBun = (args: string[], cwd: string) => {
  const child = spawn(process.execPath, args, {
    cwd,
    env: { ...process.env, BUN_BE_BUN: "1" },
    stdio: "inherit",
  });
  return new Promise<number>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
};

export const installSmokeBrowser = async (input: { withDeps: boolean }) => {
  const directory = smokeBrowserInstallDirectory();
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, "package.json"),
    JSON.stringify({ private: true, dependencies: { "playwright-core": smokePlaywrightVersion } }),
  );
  const installed = await runBundledBun(["install", "--ignore-scripts"], directory);
  if (installed !== 0) return installed;
  return runBundledBun(
    [
      join(directory, "node_modules", "playwright-core", "cli.js"),
      "install",
      "chromium",
      "--no-shell",
      ...(input.withDeps ? ["--with-deps"] : []),
    ],
    directory,
  );
};
