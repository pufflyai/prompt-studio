import { type CommandContext, commandRef } from "@pstdio/sdk/extensions";
import type { ReviewState } from "./motion/review-state";

// Frozen, read-only migration endpoints under the previous storage owners. These optional
// providers have no UI; ordinary projects do not need either one installed.
export const legacyMotionReview = commandRef<{ study: string }, ReviewState | undefined>({
  extensionId: "pstdio.motion-lab",
  id: "review.export",
});
export const legacyShaderComparison = commandRef<{ shader: string }, string | undefined>({
  extensionId: "pstdio.pstdio-shader-lab",
  id: "compare.export",
});

export const readLegacyMotion = async (ctx: CommandContext, study: string) => {
  try {
    const result = await ctx.commands.execute(legacyMotionReview, { params: { study } });
    return result.status === "success" ? result.value : undefined;
  } catch {
    return undefined;
  }
};
export const readLegacyComparison = async (ctx: CommandContext, shader: string) => {
  try {
    const result = await ctx.commands.execute(legacyShaderComparison, { params: { shader } });
    return result.status === "success" ? result.value : undefined;
  } catch {
    return undefined;
  }
};
