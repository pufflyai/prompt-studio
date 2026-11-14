import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const HEALTH_SYNC_FILE = "releases/sync.json";

export const readHealthSync = async (ctx: Pick<ExtensionContextBase, "extensionFiles" | "automation">) => {
  if (!ctx.extensionFiles || !(await ctx.extensionFiles.exists(HEALTH_SYNC_FILE))) return null;
  const id = JSON.parse(await ctx.extensionFiles.readText(HEALTH_SYNC_FILE)) as string;
  return (await ctx.automation.get(id)) ?? null;
};
