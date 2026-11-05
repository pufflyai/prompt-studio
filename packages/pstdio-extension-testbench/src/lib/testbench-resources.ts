import {
  type ExtensionResourcesApi,
  type ExtensionWorkspace,
  type ResourceIdentity,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { createMemoryResources, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";

export const createBenchResources = async (
  prefixes: Record<string, string>,
  seeds: ResourceIdentity[] = [],
  projectId = "bench-project",
  workspaces: ExtensionWorkspace[] = [],
) => {
  const byId = new Map(seeds.map((identity) => [identity.id, identity]));
  const sequences = new Map<string, number>();
  for (const identity of seeds) {
    const prefix = `${prefixes[identity.kind]}-`;
    if (!identity.shorthand.startsWith(prefix)) continue;
    const sequence = Number(identity.shorthand.slice(prefix.length));
    if (Number.isSafeInteger(sequence) && sequence > 0)
      sequences.set(identity.kind, Math.max(sequences.get(identity.kind) ?? 0, sequence));
  }
  const context = makeCommandContext({ storage: createMemoryStorage(), params: {}, projectId });
  const workspaceById = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  await Promise.all(
    workspaces.map((workspace) =>
      context.resources.addAnchors(
        {
          type: "workspace",
          id: workspace.id,
          extensionId: "pstdio",
          label: workspace.name || workspace.workspace_shorthand || workspace.id,
        },
        workspace.anchors_json ?? [],
      ),
    ),
  );
  const allocated = createMemoryResources(prefixes, sequences, undefined, {
    projectId,
    extensionId: context.extensionId,
  });
  const seededIdentity = (kind: string, id: string) => {
    const identity = byId.get(id);
    return identity?.kind === kind ? structuredClone(identity) : null;
  };
  const resources: ExtensionResourcesApi = {
    ...context.resources,
    resolveMany: async (refs) =>
      refs.flatMap((ref) => {
        if (ref.projectId && ref.projectId !== projectId) return [];
        const workspace =
          ref.type === "workspace" && ref.extensionId === "pstdio" ? workspaceById.get(ref.id) : undefined;
        if (!workspace) return [];
        const resource = {
          ...ref,
          projectId,
          label: workspace.name || workspace.workspace_shorthand || workspace.id,
          icon: "folder",
        };
        return [{ resource, target: { kind: "page" as const, page: workbenchPages.workspace, resource } }];
      }),
    allocate: allocated.allocate,
    identity: async (input) => seededIdentity(input.kind, input.id) ?? allocated.identity(input),
    identityMany: async (input) => {
      const identities = await allocated.identityMany(input);
      return input.ids.map((id, index) => seededIdentity(input.kind, id) ?? identities[index] ?? null);
    },
    findByShorthand: async (input) => {
      const matches = [
        ...seeds.filter(
          (identity) =>
            identity.kind === input.kind &&
            (identity.shorthand === input.shorthand || identity.aliases.includes(input.shorthand)),
        ),
        ...(await allocated.findByShorthand(input)),
      ];
      return structuredClone(
        matches.sort((a, b) => Number(b.shorthand === input.shorthand) - Number(a.shorthand === input.shorthand)),
      );
    },
  };
  return resources;
};
