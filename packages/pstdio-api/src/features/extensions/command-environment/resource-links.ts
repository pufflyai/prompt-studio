import {
  addResourceAnchorsSchema,
  relatedResourceQuerySchema,
  removeResourceAnchorsSchema,
  resourceAnchorQuerySchema,
  resourceAnchorsQuerySchema,
} from "pstdio-api-contracts";
import type {
  RelatedResourceQuery,
  ResourceAnchor,
  ResourceAnchorQuery,
  ResourceRef,
} from "pstdio-api-contracts/extension-kernel";
import { publishResourceAnchorChanges, refreshResourceAnchorEndpoints } from "../../../services/resource-anchor-events";
import type { ExtensionsRouteDeps } from "../deps";
import { canonicalResource, createAnchorPolicy } from "./resource-link-policy";

export const createResourceLinksApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string },
) => {
  const canonical = (resource: ResourceRef) => canonicalResource(deps, input, resource);
  const listAnchors = async (query: ResourceAnchorQuery) => {
    const page = await deps.resourceLinksService.list({
      ...resourceAnchorQuerySchema.parse(query),
      resource: await canonical(query.resource),
    });
    const items = await Promise.all(
      page.items.map(async (item) => ({
        source: await canonical(item.source),
        target: { ...(await canonical(item.target)), role: item.target.role },
      })),
    );
    return { ...page, items };
  };

  const publish = async (
    items: Array<{ source: ResourceRef; target: ResourceAnchor }>,
    operation: "add" | "remove",
  ) => {
    if (!items.length) return;
    publishResourceAnchorChanges(deps.eventBus, items, operation);
    await refreshResourceAnchorEndpoints(deps.eventBus, items, {
      project: deps.projectService.get,
      workspace: deps.workspaceService.get,
      session: deps.sessionService.get,
    });
  };
  return {
    queryRelated: async (query: RelatedResourceQuery) => {
      const parsed = relatedResourceQuerySchema.parse(query);
      const page = await deps.resourceLinksService.related({
        ...parsed,
        resources: await Promise.all(parsed.resources.map(canonical)),
      });
      return { ...page, items: await Promise.all(page.items.map(canonical)) };
    },
    queryAnchorsMany: async (query: Omit<ResourceAnchorQuery, "resource"> & { resources: ResourceRef[] }) => {
      const parsed = resourceAnchorsQuerySchema.parse(query);
      const page = await deps.resourceLinksService.listMany({
        ...parsed,
        resources: await Promise.all(parsed.resources.map(canonical)),
      });
      const items = await Promise.all(
        page.items.map(async (item) => ({
          source: await canonical(item.source),
          target: { ...(await canonical(item.target)), role: item.target.role },
        })),
      );
      return { ...page, items, nextCursor: page.nextCursor ?? null };
    },
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
    queryAnchors: async (query: ResourceAnchorQuery) => {
      const page = await listAnchors(query);
      return { ...page, nextCursor: page.nextCursor ?? null };
    },
    listAnchors,
    removedLinks: async (resource: ResourceRef) =>
      publish(await deps.resourceLinksService.removeResource(await canonical(resource)), "remove"),
  };
};
