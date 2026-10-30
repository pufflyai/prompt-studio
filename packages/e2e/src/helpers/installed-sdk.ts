import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Install the shipped SDK and its declared dependencies, as an external extension does. */
export const installBuiltSdk = (extension: string) => {
  const run = (cwd: string, args: string[]) => {
    execFileSync(process.versions.bun ? process.execPath : "bun", args, { cwd, stdio: "pipe" });
  };
  const archive = join(extension, "sdk.tgz");
  run(resolve(import.meta.dirname, "../../../sdk/.publish"), ["pm", "pack", "--filename", archive]);
  const manifestPath = join(extension, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  manifest.dependencies = { ...manifest.dependencies, "@pstdio/sdk": "file:./sdk.tgz" };
  writeFileSync(manifestPath, JSON.stringify(manifest));
  run(extension, ["install", "--ignore-scripts", "--no-progress"]);
};
