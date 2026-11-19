import type { ExtensionContextBase, JsonObject } from "@pstdio/sdk/extensions";
import { git } from "./git";

export const validateGitParams = async (ctx: ExtensionContextBase, params: JsonObject) => {
  const home = await ctx.workspaces.getDefault();
  if (home?.executionKind !== "local" || !home.rootPath)
    throw new Error("A local project folder is required for a Git workspace.");
  if (typeof params.base !== "string") throw new Error("Choose a base revision.");
  try {
    await git(ctx, ["rev-parse", "--verify", "--end-of-options", `${params.base}^{commit}`], home.rootPath);
  } catch (cause) {
    throw new Error(`base "${params.base}" must resolve to a valid Git commit.`, { cause });
  }
};
