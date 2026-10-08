import { addResourceAnchorsSchema, removeResourceAnchorsSchema, resourceAnchorQuerySchema } from "pstdio-api-contracts";
import type { ResourceAnchor, ResourceAnchorQuery, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { publishResourceAnchorChanges, refreshLegacyAnchorSources } from "../../../services/resource-anchor-events";
import type { ExtensionsRouteDeps } from "../deps";
import { canonicalResource, createAnchorPolicy } from "./resource-link-policy";

export const createResourceLinksApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string },
) => {
  const canonical = (resource: ResourceRef) => canonicalResource(deps, input, resource);

  const publish = async (
    items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
    operation: "add" | "remove",
  ) => {
    if (!items.length) return;
    publishResourceAnchorChanges(deps.eventBus, items, operation);
    await refreshLegacyAnchorSources(deps.eventBus, items, {
      workspace: deps.workspaceService.get,
      session: deps.sessionService.get,
    });
  };
  return {
    addAnchors: async (resource: ResourceRef, anchors: ResourceAnchor[]) => {
      ({ resource, anchors } = addResourceAnchorsSchema.parse({ resource, anchors }));
      const policy = await createAnchorPolicy(deps, input.projectId);
      const source = await canonical(resource);
      const targets = await Promise.all(anchors.map((anchor) => canonical(anchor)));
      policy.requireKind(source);
      for (const target of targets) {
        await policy.validate(source, target, "add");
        policy.requireKind(target);
      }
      await publish(await deps.resourceLinksService.add(source, targets), "add");
    },
    removeAnchors: async (resource: ResourceRef, refs: ResourceRef[]) => {
      ({ resource, refs } = removeResourceAnchorsSchema.parse({ resource, refs }));
      const policy = await createAnchorPolicy(deps, input.projectId);
      const source = await canonical(resource);
      const targets = await Promise.all(refs.map((ref) => canonical(ref)));
      // Validators run outside the transaction. Retry if an edge changed while they ran.
      while (true) {
        const existing = await deps.resourceLinksService.find(source, targets);
        for (const target of targets) {
          const stored = existing.find(
            (edge) =>
              edge.target.extensionId === target.extensionId &&
              edge.target.type === target.type &&
              edge.target.id === target.id,
          );
          await policy.validate(source, stored?.target ?? target, "remove");
        }
        const changed = await deps.resourceLinksService.removeValidated(source, targets, existing);
        if (changed === null) continue;
        await publish(changed, "remove");
        return;
      }
    },
    listAnchors: async (query: ResourceAnchorQuery) =>
      deps.resourceLinksService.list({
        ...resourceAnchorQuerySchema.parse(query),
        resource: await canonical(query.resource),
      }),
    removedLinks: async (resource: ResourceRef) =>
      publish(await deps.resourceLinksService.removeResource(await canonical(resource)), "remove"),
  };
};
