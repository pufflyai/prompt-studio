import {
  addResourceAnchorsSchema,
  removeResourceAnchorsSchema,
  resourceAnchorQuerySchema,
  resourceAnchorsQuerySchema,
} from "pstdio-api-contracts";
import type { ResourceAnchor, ResourceAnchorQuery, ResourceRef } from "pstdio-api-contracts/extension-kernel";
import { createReadBoundary } from "pstdio-extensions";
import { publishResourceAnchorChanges, refreshResourceAnchorSources } from "../../../services/resource-anchor-events";
import type { ExtensionsRouteDeps } from "../deps";
import { canonicalResource, createAnchorPolicy } from "./resource-link-policy";

export const createResourceLinksApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionId?: string; signal?: AbortSignal },
) => {
  const read = createReadBoundary(input.signal);
  const canonical = (resource: ResourceRef) => read(() => canonicalResource(deps, input, resource));
  // Writes retain project and owner validation independently of the reader lifetime.
  const canonicalWrite = (resource: ResourceRef) =>
    canonicalResource(deps, { projectId: input.projectId, extensionId: input.extensionId }, resource);
  const listAnchors = async (query: ResourceAnchorQuery) => {
    const parsed = resourceAnchorQuerySchema.parse(query);
    const resource = await canonical(parsed.resource);
    const page = await read(() => deps.resourceLinksService.list({ ...parsed, resource }));
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
    await refreshResourceAnchorSources(deps.eventBus, items, {
      project: deps.projectService.get,
      workspace: deps.workspaceService.get,
      session: deps.sessionService.get,
    });
  };
  return {
    queryAnchorsMany: async (query: Omit<ResourceAnchorQuery, "resource"> & { resources: ResourceRef[] }) => {
      const parsed = resourceAnchorsQuerySchema.parse(query);
      const resources = await Promise.all(parsed.resources.map(canonical));
      const page = await read(() => deps.resourceLinksService.listMany({ ...parsed, resources }));
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
      const source = await canonicalWrite(resource);
      const targets = await Promise.all(anchors.map(canonicalWrite));
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
      const source = await canonicalWrite(resource);
      const targets = await Promise.all(refs.map(canonicalWrite));
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
      publish(await deps.resourceLinksService.removeResource(await canonicalWrite(resource)), "remove"),
  };
};
