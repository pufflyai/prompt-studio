import type { ExtensionContextBase } from "@pstdio/sdk/extensions";
import {
  artifactResource,
  artifactsCollection,
  ensureInitialArtifacts,
  type GlassLabArtifact,
} from "../commands/glass-lab-artifacts-command";
import { labArtifactsChanged } from "../events";

const workflowStatusIds = new Set(["idea", "testing"]);

export const queryLabWorkflowArtifacts = async (ctx: Pick<ExtensionContextBase, "storage">, _input: object) => {
  await ensureInitialArtifacts(ctx.storage);
  const artifacts = await artifactsCollection(ctx.storage).list();
  return {
    rows: artifacts.map((artifact) => ({
      id: artifact.id,
      title: artifact.title,
      attributes: { status: artifact.status },
      resource: artifactResource(artifact),
    })),
    boardColumnConfigs: {
      idea: { color: "gray", canCreate: true, canDragIn: true, canDragOut: true },
      testing: { color: "blue", canCreate: false, canDragIn: true, canDragOut: true },
    },
  };
};

export const updateLabWorkflowArtifact = async (
  ctx: Pick<ExtensionContextBase, "events" | "storage">,
  input: { rowId: string; attributeId: string; value: unknown },
) => {
  if (input.attributeId !== "status" || typeof input.value !== "string" || !workflowStatusIds.has(input.value)) {
    return null;
  }
  const collection = artifactsCollection(ctx.storage);
  const artifact = await collection.get(input.rowId);
  if (!artifact) return null;
  const updated = { ...artifact, status: input.value as GlassLabArtifact["status"] };
  await collection.put(updated.id, updated);
  await ctx.events.emit(labArtifactsChanged, { artifactId: updated.id });
  return updated;
};
