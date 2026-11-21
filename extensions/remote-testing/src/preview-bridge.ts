import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export async function requirePreviewBridge(ctx: ExtensionContextBase) {
  const path = (await ctx.settings.all()).previewBridgePath;
  if (typeof path !== "string" || !path.trim())
    throw new Error("Set the Preview URL helper in Remote Testing settings.");
  if (!(await Bun.file(path).exists()))
    throw new Error("The configured Preview URL helper was not found on this device.");
  return path;
}
