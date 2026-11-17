import { defineCommand, l10n, params, type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { artifactOwnerFor, serviceFor } from "./artifact-context";
import { removeArtifact, renameArtifact } from "./artifact-mutations";
import { artifactUrl } from "./contracts";
import { sitePaths } from "./mounts";
import { artifactActionsSlot } from "./resource-kinds";

const artifactParam = params.text({ required: true, resolvedFrom: "resource" });
export const resolveResource = defineCommand({
  id: "resolve-resource",
  title: l10n("commands.resolve", "Resolve artifact"),
  params: { artifactId: artifactParam },
  run: (ctx, input) => serviceFor(ctx).resolve(input.artifactId),
});

export const resolveResources = defineCommand({
  id: "resolve-resources",
  title: l10n("commands.resolveMany", "Resolve linked artifacts"),
  params: { resources: params.json<ResourceRef[]>() },
  async run(ctx, input) {
    const requested = input.resources ?? [];
    if (requested.length > 100) throw new Error("Resolve at most 100 artifacts.");
    const refs = new Map(
      requested
        .filter(
          (ref) =>
            ref.type === "artifact" && ref.extensionId === artifactOwnerFor(ctx) && ref.projectId === ctx.projectId,
        )
        .map((ref) => [resourceKey(ref), ref]),
    );
    if (!refs.size) return [];
    const current = new Map((await serviceFor(ctx).list()).map((item) => [resourceKey(item.resource), item]));
    return [...refs.keys()].flatMap((key) => {
      const item = current.get(key);
      return item ? [{ resource: { ...item.resource, icon: "file-code" }, target: item.target }] : [];
    });
  },
});

export const resolvePath = defineCommand({
  id: "resolve-path",
  title: l10n("commands.resolvePath", "Resolve artifact path"),
  params: { path: params.text({ required: true }), workspaceId: params.text({ required: true }) },
  async run(ctx, input) {
    const prefix = sitePaths.find((prefix) => input.path.startsWith(prefix));
    const name = prefix ? input.path.slice(prefix.length) : "";
    const revisionId = /^([^/]+)\.html$/.exec(name)?.[1];
    return revisionId ? serviceFor(ctx).resolveRevision(revisionId) : null;
  },
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
