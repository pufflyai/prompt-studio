import {
  defineCommand,
  type ExtensionContextBase,
  type ExtensionStorageApi,
  type JsonValue,
  l10n,
  params,
} from "@pstdio/sdk/extensions";
import { labArtifactsChanged } from "../events";

const resourceKind = "glass-lab-artifact";
const artifactsCollectionName = "glass-lab-artifacts";

const artifactSubjects = ["Interview room", "Session deck", "Facility keycard", "Observation mirror"];
const artifactQualifiers = ["Glass", "Turing", "Remote", "Sealed", "Inert"];
const artifactRoles = ["observation", "evaluation", "access"] as const;
const artifactStatuses = ["idea", "testing"] as const;
const artifactCustodies = ["Quarantine shelf", "Review bench", "Operator locker", "Transit case"];
const artifactNextSteps = ["Compare against control notes", "Route through review checks", "Request operator sign-off"];

export interface GlassLabArtifact {
  id: string;
  title: string;
  role: (typeof artifactRoles)[number];
  trustSignal: number;
  status: (typeof artifactStatuses)[number];
  summary: string;
  custody: string;
  nextStep: string;
}

const randomItem = <T>(values: readonly T[]) => values[Math.floor(Math.random() * values.length)]!;

export const createRandomArtifact = (overrides: Partial<GlassLabArtifact> = {}): GlassLabArtifact => ({
  id: crypto.randomUUID(),
  title: `${randomItem(artifactQualifiers)} ${randomItem(artifactSubjects)}`,
  role: randomItem(artifactRoles),
  trustSignal: Math.floor(Math.random() * 101),
  status: randomItem(artifactStatuses),
  summary: "Cataloged by the Action Tray for follow-up in the active lab workspace.",
  custody: randomItem(artifactCustodies),
  nextStep: randomItem(artifactNextSteps),
  ...overrides,
});

export const artifactsCollection = (storage: ExtensionStorageApi) =>
  storage.collection<GlassLabArtifact>(artifactsCollectionName);

export const artifactResource = (artifact: GlassLabArtifact) => ({
  type: resourceKind,
  id: artifact.id,
  label: artifact.title,
  metadata: {
    role: artifact.role,
    trustSignal: artifact.trustSignal,
    status: artifact.status,
    summary: artifact.summary,
    custody: artifact.custody,
    nextStep: artifact.nextStep,
  },
});

const columns = [
  { id: "artifact", label: "Artifact" },
  { id: "role", label: "Role", stat: { type: "top-values" as const } },
  { id: "trustSignal", label: "Trust signal", stat: { type: "histogram" as const } },
  { id: "status", label: "Status", stat: { type: "top-values" as const } },
];

export const queryGlassLabArtifacts = async (ctx: Pick<ExtensionContextBase, "storage">, _input: object) => {
  const artifacts = await artifactsCollection(ctx.storage).list();
  return {
    rows: artifacts.map((artifact) => ({
      id: artifact.id,
      values: {
        artifact: artifact.title,
        role: artifact.role,
        trustSignal: artifact.trustSignal,
        status: artifact.status,
      },
      resource: artifactResource(artifact),
    })),
    columns,
  };
};

export const queryGlassLabArtifactsCommand = defineCommand({
  id: "glass-lab-artifacts.query",
  title: l10n("commands.glassLabArtifacts.query.title", "Query Glass Lab artifacts"),
  run: queryGlassLabArtifacts,
});

export const createGlassLabArtifactCommand = defineCommand({
  id: "glass-lab-artifacts.create",
  title: l10n("commands.glassLabArtifacts.create.title", "Create random Glass Lab artifact"),
  async run(ctx, _commandParams) {
    const artifact = createRandomArtifact();
    await artifactsCollection(ctx.storage).put(artifact.id, artifact);
    await ctx.events.emit(labArtifactsChanged, { artifactId: artifact.id });
    return artifact;
  },
});

export const queryArtifactMenu = async (_ctx: ExtensionContextBase, _input: object) => ({
  groups: [
    {
      id: "create",
      title: "Catalog intake",
      description: "Create Glass Lab artifacts without leaving the table.",
      params: [
        {
          id: "create",
          name: "New artifact",
          type: "actions",
          options: [
            { id: "random", name: "Random artifact" },
            { id: "testing", name: "Testing artifact" },
          ],
        },
      ],
    },
  ],
  values: {},
});

export const queryArtifactMenuCommand = defineCommand({
  id: "artifact-menu.query",
  title: l10n("commands.artifactMenu.query.title", "Query the artifact creation menu"),
  run: queryArtifactMenu,
});

interface ArtifactMenuUpdateInput {
  controlId: string;
  value?: JsonValue;
}

export const updateArtifactMenu = async (
  ctx: Pick<ExtensionContextBase, "events" | "storage">,
  input: ArtifactMenuUpdateInput,
) => {
  // The ParamEditor issues extra update calls (value syncs) beyond the action
  // click, so only the two known action values may create an artifact.
  if (input.controlId !== "create") return { value: input.value };
  if (input.value !== "random" && input.value !== "testing") return { value: input.value };
  const artifact =
    input.value === "testing"
      ? createRandomArtifact({ status: "testing", summary: "Sent to testing by the Create artifacts menu." })
      : createRandomArtifact();
  await artifactsCollection(ctx.storage).put(artifact.id, artifact);
  await ctx.events.emit(labArtifactsChanged, { artifactId: artifact.id });
  return artifact;
};

export const updateArtifactMenuCommand = defineCommand({
  id: "artifact-menu.update",
  title: l10n("commands.artifactMenu.update.title", "Create an artifact from the menu"),
  params: {
    controlId: params.text({ required: true }),
    value: params.json<string>(),
  },
  run: updateArtifactMenu,
});

export const deleteGlassLabArtifactCommand = defineCommand({
  id: "glass-lab-artifacts.delete",
  title: l10n("commands.glassLabArtifacts.delete.title", "Delete Glass Lab artifact"),
  params: { rowId: params.text({ required: true }) },
  async run(ctx, commandParams) {
    await artifactsCollection(ctx.storage).delete(commandParams.rowId);
    await ctx.events.emit(labArtifactsChanged, { artifactId: commandParams.rowId });
    return { id: commandParams.rowId };
  },
});
