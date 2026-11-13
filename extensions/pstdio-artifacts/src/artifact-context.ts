import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { type ArtifactRevision, createArtifactService } from "./artifacts";
import { extensionId } from "./events";
import { sites } from "./mounts";

export const artifactOwnerFor = (ctx: Pick<ExtensionContextBase, "extensionId">) =>
  ["pstdio.artifacts", "pstdio.pstdio-artifacts"].includes(ctx.extensionId) ? ctx.extensionId : extensionId;

export const serviceFor = (ctx: ExtensionContextBase) =>
  createArtifactService({
    projectId: ctx.projectId,
    extensionId: ["pstdio.artifacts", "pstdio.pstdio-artifacts"].includes(ctx.extensionId)
      ? ctx.extensionId
      : undefined,
    ids: ctx.storage.ids,
    artifacts: ctx.storage.collection<{ id: string }>("artifacts"),
    revisions: ctx.storage.collection<ArtifactRevision>("revisions"),
    names: ctx.storage.collection<{ title: string }>("names"),
    snapshots: ctx.artifacts.mount(sites.id),
  });
