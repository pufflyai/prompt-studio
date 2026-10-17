import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { serviceFor } from "./artifact-context";
import { removeArtifact, renameArtifact } from "./artifact-mutations";
import { artifactUrl } from "./contracts";
import { artifactActionsSlot } from "./resource-kinds";

const artifactParam = params.text({ required: true, resolvedFrom: "resource" });
export const resolveResource = defineCommand({
  id: "resolve-resource",
  title: l10n("commands.resolve", "Resolve artifact"),
  params: { artifactId: artifactParam },
  run: (ctx, input) => serviceFor(ctx).resolve(input.artifactId),
});

export const renameResource = defineCommand({
  id: "rename-resource",
  title: l10n("commands.rename", "Rename artifact"),
  cli: true,
  mutating: true,
  menus: [
    { slot: artifactActionsSlot, placement: "first", label: l10n("reader.rename", "Rename artifact…"), icon: "pencil" },
  ],
  resourceMutation: { kind: "rename", resourceType: "artifact", idParam: "artifactId", labelParam: "name" },
  params: {
    artifactId: artifactParam,
    name: params.text({ label: l10n("rename.name", "Artifact name"), required: true }),
  },
  run: (ctx, input) => renameArtifact(ctx, artifactUrl(ctx.projectId, input.artifactId), input.name),
});

export const deleteResource = defineCommand({
  id: "delete-resource",
  title: l10n("commands.delete", "Delete artifact"),
  cli: true,
  mutating: true,
  menus: [{ slot: artifactActionsSlot, label: l10n("reader.delete", "Delete artifact…"), icon: "trash" }],
  resourceMutation: { kind: "remove", resourceType: "artifact", idParam: "artifactId" },
  params: { artifactId: artifactParam },
  run: (ctx, input) => removeArtifact(ctx, artifactUrl(ctx.projectId, input.artifactId)),
});
