export type ManagedBunCommand = {
  args: string[];
  env: NodeJS.ProcessEnv;
  file: string;
};

export { isPackagedRuntime } from "pstdio-paths";

export const resolveManagedBunCommand = (input: {
  args: string[];
  bunCacheDir: string;
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  processExecPath: string;
}): ManagedBunCommand => ({
  args: input.args,
  env: {
    ...input.env,
    BUN_INSTALL_CACHE_DIR: input.bunCacheDir,
    ...(input.isPackaged ? { BUN_BE_BUN: "1" } : {}),
  },
  file: input.isPackaged ? input.processExecPath : "bun",
});
