import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import { type ArtifactRevision, createArtifactService } from "./artifacts";

export const serviceFor = (ctx: ExtensionContextBase) =>
  createArtifactService({
    projectId: ctx.projectId,
    artifacts: ctx.storage.collection<{ id: string }>("artifacts"),
    revisions: ctx.storage.collection<ArtifactRevision>("revisions"),
    names: ctx.storage.collection<{ title: string }>("names"),
    snapshots: ctx.artifacts.mount("sites"),
  });
