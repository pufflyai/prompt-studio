import type { ExtensionContextBase, ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { artifactResource, artifactsCollection, type GlassLabArtifact } from "../commands/glass-lab-artifacts-command";
import { labArtifactsChanged } from "../events";

const seededKey = "glass-lab-artifacts.workflow-seeded";
const workflowStatusIds = new Set(["idea", "testing"]);

const initialArtifacts: GlassLabArtifact[] = [
  {
    id: "concept",
    title: "Shape the concept",
    role: "evaluation",
    trustSignal: 35,
    status: "idea",
    summary: "A draft artifact used to test the Lab workflow board.",
    custody: "Review bench",
    nextStep: "Move the artifact into testing",
  },
  {
    id: "prototype",
    title: "Test the prototype",
    role: "observation",
    trustSignal: 72,
    status: "testing",
    summary: "A prototype artifact already under evaluation.",
    custody: "Quarantine shelf",
    nextStep: "Record the testing result",
  },
];

const ensureInitialArtifacts = async (storage: ExtensionStorageApi) => {
  if (await storage.get<boolean>(seededKey)) return;
  const collection = artifactsCollection(storage);
  for (const artifact of initialArtifacts) {
    if (!(await collection.get(artifact.id))) await collection.put(artifact.id, artifact);
  }
  await storage.set(seededKey, true);
};

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
