import type { ExtensionContextBase } from "@pstdio/sdk/extensions";

export const extensionId = "pstdio.pstdio-artifacts";
export const changedEvent = `${extensionId}.artifacts.changed`;

export const emitArtifactChanged = (ctx: ExtensionContextBase, artifactId: string) =>
  ctx.events.emit(changedEvent, { artifactId }, { refresh: { extensionId, resourceIds: [artifactId] } });
