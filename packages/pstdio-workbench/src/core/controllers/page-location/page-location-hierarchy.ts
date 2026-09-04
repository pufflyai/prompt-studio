import type { NavigationTargetPage, PageRef, ResourceRef as PageResourceRef } from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";
import {
  isWorkbenchViewHierarchyNode,
  type ResourceRef,
  type ResourceRegistry,
  type WorkbenchHierarchyNode,
} from "../../registries/resources/resource-registry";

const primarySlot = (page: WorkbenchPageContribution) => page.slots.find((slot) => slot.role === "primary");

const pageForView = (pages: readonly WorkbenchPageContribution[], viewId: string) =>
  pages.find((page) => {
    const primary = primarySlot(page);
    return primary?.viewId === viewId || primary?.binding?.viewId === viewId;
  });

const pageForResource = (pages: readonly WorkbenchPageContribution[], kind: string) =>
  pages.find((page) => primarySlot(page)?.binding?.resourceKinds.includes(kind));

const toWorkbenchResource = (resource: PageResourceRef, resources: WorkbenchPageResourceCodec): ResourceRef => {
  const normalized = resources.normalize(resource);
  return {
    kind: normalized.type,
    uri: resources.toUri(normalized),
    id: normalized.id,
    label: normalized.label,
    metadata: normalized.metadata,
  };
};

const toPageResource = (resource: ResourceRef): PageResourceRef => ({
  type: resource.kind,
  id: resource.id ?? resource.uri,
  label: resource.label,
  metadata: resource.metadata as PageResourceRef["metadata"],
});

const pageRefForNode = (
  node: WorkbenchHierarchyNode,
  pages: readonly WorkbenchPageContribution[],
): PageRef | undefined => {
  if (isWorkbenchViewHierarchyNode(node)) return pageForView(pages, node.viewId)?.ref;
  return pageForResource(pages, node.kind)?.ref;
};

export const contextualizeWorkbenchPageTarget = (input: {
  target: NavigationTargetPage;
  pages: readonly WorkbenchPageContribution[];
  registry: ResourceRegistry;
  resources: WorkbenchPageResourceCodec;
}) => {
  if (input.target.parent || !input.target.resource) return input.target;
  const hierarchy = input.registry.walkHierarchy(toWorkbenchResource(input.target.resource, input.resources));
  if (hierarchy.length <= 1) return input.target;

  let parent: NavigationTargetPage | undefined;
  for (const node of hierarchy.slice(0, -1)) {
    const page = pageRefForNode(node, input.pages);
    if (!page) continue;
    const resource = isWorkbenchViewHierarchyNode(node) ? undefined : toPageResource(node);
    parent = {
      kind: "page",
      page,
      ...(resource ? { resource } : {}),
      ...(parent ? { parent } : {}),
    };
  }
  return parent ? { ...input.target, parent } : input.target;
};
