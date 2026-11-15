import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { serviceFor } from "./artifact-context";
import { emitArtifactChanged } from "./events";

export const renameArtifact = async (ctx: ExtensionContextBase, url: string, name: string) => {
  const result = await serviceFor(ctx).rename(url, name);
  await emitArtifactChanged(ctx, result.artifactId);
  return result;
};

export const removeArtifact = async (ctx: ExtensionContextBase, url: string) => {
  const result = await serviceFor(ctx).remove(url);
  await ctx.resources.removed({ type: "artifact", id: result.artifactId });
  await emitArtifactChanged(ctx, result.artifactId);
  return result;
};
