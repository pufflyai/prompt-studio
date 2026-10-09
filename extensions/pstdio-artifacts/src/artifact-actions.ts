import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { removeArtifact, renameArtifact } from "./artifact-mutations";
import { artifactUrl } from "./contracts";

const artifactParam = params.text({ required: true, resolvedFrom: "resource" });

export const renameResource = defineCommand({
  id: "rename-resource",
  title: l10n("commands.rename", "Rename artifact"),
  cli: true,
  mutating: true,
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
  resourceMutation: { kind: "remove", resourceType: "artifact", idParam: "artifactId" },
  params: { artifactId: artifactParam },
  run: (ctx, input) => removeArtifact(ctx, artifactUrl(ctx.projectId, input.artifactId)),
});
