import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const readHome = async (ctx: ExtensionContextBase) => {
  const workspace = await ctx.workspaces.getDefault();
  return { project: ctx.project, setupError: workspace?.setupError ?? null };
};
