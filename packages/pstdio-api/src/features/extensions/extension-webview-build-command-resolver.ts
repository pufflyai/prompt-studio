import { join } from "node:path";
import { isPackagedRuntime, resolveManagedBunCommand } from "./extension-bun-runner";
import { resolvePstdioHome } from "./install-extension-source";

type ManagedCommand = {
  args: string[];
  env: NodeJS.ProcessEnv;
  file: string;
};

export const defaultBunCacheDir = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-bun-install");

export const defaultWebviewCacheRoot = (env: NodeJS.ProcessEnv) =>
  join(resolvePstdioHome({ env }), "cache", "extension-webviews");

export const resolveManagedWebviewBuildCommand = (input: {
  args: string[];
  bunCacheDir: string;
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  processExecPath: string;
}): ManagedCommand =>
  resolveManagedBunCommand({
    args: input.args,
    bunCacheDir: input.bunCacheDir,
    env: input.env,
    isPackaged: input.isPackaged,
    processExecPath: input.processExecPath,
  });

export const buildArgs = (entryPath: string, distDir: string) => [
  "build",
  entryPath,
  "--outdir",
  distDir,
  "--target",
  "browser",
  "--format",
  "esm",
  "--entry-naming",
  "module.[ext]",
  "--asset-naming",
  "[name]-[hash].[ext]",
];

export const resolveIsPackaged = (value: boolean | undefined) => value ?? isPackagedRuntime();
