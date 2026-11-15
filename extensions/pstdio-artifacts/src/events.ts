import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const extensionId = "pstdio.artifacts";
// Preserve the historical public event key independently of the current owner.
export const changedEvent = "pstdio.pstdio-artifacts.artifacts.changed";

export const emitArtifactChanged = (ctx: ExtensionContextBase, artifactId: string) =>
  ctx.events.emit(changedEvent, { artifactId }, { refresh: { extensionId, resourceIds: [artifactId] } });
