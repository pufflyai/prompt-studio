import type {
  FileRendererSectionTarget,
  NavigationTargetPage,
  PageLocation,
  PageRef,
  ResourceRef,
} from "@pstdio/sdk/extensions";
import type { WorkbenchPageContribution, WorkbenchPageResourceCodec } from "../../registries/pages/page-registry";

export const workbenchPageRefKey = (ref: PageRef) => `${ref.extensionId ?? ""}:page:${ref.id}`;

const pageForRef = (pages: readonly WorkbenchPageContribution[], ref: PageRef) =>
  pages.find((page) => workbenchPageRefKey(page.ref) === workbenchPageRefKey(ref));

const pageForId = (pages: readonly WorkbenchPageContribution[], pageId: string) =>
  pages.find((page) => page.id === pageId);

const canonicalSection = (section: FileRendererSectionTarget | undefined) => {
  if (!section) return undefined;
  const anchors = section.anchors.map((anchor) =>
    Object.freeze({
      id: anchor.id,
      heading: anchor.heading,
      ...(anchor.occurrence !== undefined ? { occurrence: anchor.occurrence } : {}),
    }),
  );
  return Object.freeze({ anchors: Object.freeze(anchors) }) as FileRendererSectionTarget;
};

const cloneMetadata = (metadata: ResourceRef["metadata"]) => {
  if (!metadata) return undefined;
  return JSON.parse(JSON.stringify(metadata)) as NonNullable<ResourceRef["metadata"]>;
};

const canonicalResource = (resource: ResourceRef | undefined, resources: WorkbenchPageResourceCodec) => {
  if (!resource) return undefined;
  const normalized = resources.normalize(resource);
  if (!normalized.type || !normalized.id) throw new Error("Page resource has no canonical type or id");
  const canonical = {
    type: normalized.type,
    id: normalized.id,
    ...(normalized.projectId ? { projectId: normalized.projectId } : {}),
    ...(normalized.label ? { label: normalized.label } : {}),
    ...(normalized.extensionId ? { extensionId: normalized.extensionId } : {}),
    ...(normalized.metadata ? { metadata: cloneMetadata(normalized.metadata) } : {}),
  };
  return Object.freeze(canonical) as ResourceRef;
};

const canonicalPageRef = (page: WorkbenchPageContribution) =>
  Object.freeze({ extensionId: page.ref.extensionId, kind: "page" as const, id: page.ref.id });

const sectionKey = (section: FileRendererSectionTarget | undefined) => (section ? JSON.stringify(section) : "");

export const workbenchPageLocationRouteKey = (location: PageLocation, resources: WorkbenchPageResourceCodec) =>
  [
    workbenchPageRefKey(location.page),
    location.resource ? resources.toUri(resources.normalize(location.resource)) : "",
    sectionKey(location.section),
  ].join("|");

export const workbenchPageLocationKey = (location: PageLocation, resources: WorkbenchPageResourceCodec): string => {
  const own = workbenchPageLocationRouteKey(location, resources);
  return location.parent ? `${own}>${workbenchPageLocationKey(location.parent, resources)}` : own;
};

export const workbenchPageLocationsEqual = (
  left: PageLocation | undefined,
  right: PageLocation | undefined,
  resources: WorkbenchPageResourceCodec,
) => {
  if (!left || !right) return left === right;
  return workbenchPageLocationKey(left, resources) === workbenchPageLocationKey(right, resources);
};

const createLocation = (input: {
  page: WorkbenchPageContribution;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  parent?: PageLocation;
  resources: WorkbenchPageResourceCodec;
}) =>
  Object.freeze({
    page: canonicalPageRef(input.page),
    ...(input.resource ? { resource: canonicalResource(input.resource, input.resources) } : {}),
    ...(input.section ? { section: canonicalSection(input.section) } : {}),
    ...(input.parent ? { parent: input.parent } : {}),
  }) as PageLocation;

const declaredParent = (input: {
  page: WorkbenchPageContribution;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  seen: Set<string>;
}): PageLocation | undefined => {
  if (!input.page.parentId) return undefined;
  const parent = pageForId(input.pages, input.page.parentId);
  if (!parent) throw new Error(`Unknown parent page: ${input.page.parentId}`);
  return normalizeResolvedLocation({
    page: parent,
    pages: input.pages,
    resources: input.resources,
    seen: input.seen,
  });
};

const hybridRootParent = (input: {
  page: WorkbenchPageContribution;
  pages: readonly WorkbenchPageContribution[];
  resource: ResourceRef | undefined;
  resources: WorkbenchPageResourceCodec;
  seen: Set<string>;
}) => {
  if (!input.resource) return undefined;
  const primary = input.page.slots.find((slot) => slot.role === "primary");
  if (!primary?.viewId || !primary.binding?.resourceKinds.includes(input.resource.type)) return undefined;
  return normalizeResolvedLocation({
    page: input.page,
    pages: input.pages,
    resources: input.resources,
    seen: input.seen,
  });
};

const normalizeResolvedLocation = (input: {
  page: WorkbenchPageContribution;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  seen: Set<string>;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
  parent?: PageLocation;
}): PageLocation => {
  const candidate = createLocation({
    page: input.page,
    resources: input.resources,
    ...(input.resource ? { resource: input.resource } : {}),
    ...(input.section ? { section: input.section } : {}),
  });
  const routeKey = workbenchPageLocationRouteKey(candidate, input.resources);
  if (input.seen.has(routeKey)) throw new Error(`Page location parent cycle reaches ${input.page.id}`);
  const seen = new Set(input.seen).add(routeKey);
  const parent =
    input.parent ??
    hybridRootParent({
      page: input.page,
      pages: input.pages,
      resource: candidate.resource,
      resources: input.resources,
      seen,
    }) ??
    declaredParent({ page: input.page, pages: input.pages, resources: input.resources, seen });
  return createLocation({
    page: input.page,
    resources: input.resources,
    ...(candidate.resource ? { resource: candidate.resource } : {}),
    ...(candidate.section ? { section: candidate.section } : {}),
    ...(parent ? { parent } : {}),
  });
};

const normalizePageTarget = (input: {
  target: NavigationTargetPage;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  seen: Set<string>;
}): { pageId: string; location: PageLocation; open?: NavigationTargetPage["open"] } => {
  const page = pageForRef(input.pages, input.target.page);
  if (!page) throw new Error(`Unknown page: ${workbenchPageRefKey(input.target.page)}`);
  const candidate = createLocation({
    page,
    resources: input.resources,
    ...(input.target.resource ? { resource: input.target.resource } : {}),
    ...(input.target.section ? { section: input.target.section } : {}),
  });
  const routeKey = workbenchPageLocationRouteKey(candidate, input.resources);
  if (input.seen.has(routeKey)) throw new Error(`Page location parent cycle reaches ${page.id}`);
  const seen = new Set(input.seen).add(routeKey);
  const contextualParent = input.target.parent
    ? normalizePageTarget({ target: input.target.parent, pages: input.pages, resources: input.resources, seen })
        .location
    : undefined;
  const location = normalizeResolvedLocation({
    page,
    pages: input.pages,
    resources: input.resources,
    seen: input.seen,
    ...(candidate.resource ? { resource: candidate.resource } : {}),
    ...(candidate.section ? { section: candidate.section } : {}),
    ...(contextualParent ? { parent: contextualParent } : {}),
  });
  return { pageId: page.id, location, ...(input.target.open ? { open: input.target.open } : {}) };
};

export const normalizeWorkbenchPageTarget = (input: {
  target: NavigationTargetPage;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
}) => normalizePageTarget({ ...input, seen: new Set() });

export const normalizeWorkbenchPageLocation = (input: {
  location: PageLocation;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
}) => {
  const normalize = (location: PageLocation, seen: Set<string>): { pageId: string; location: PageLocation } => {
    const page = pageForRef(input.pages, location.page);
    if (!page) throw new Error(`Unknown page: ${workbenchPageRefKey(location.page)}`);
    const candidate = createLocation({
      page,
      resources: input.resources,
      ...(location.resource ? { resource: location.resource } : {}),
      ...(location.section ? { section: location.section } : {}),
    });
    const routeKey = workbenchPageLocationRouteKey(candidate, input.resources);
    if (seen.has(routeKey)) throw new Error(`Page location parent cycle reaches ${page.id}`);
    const nextSeen = new Set(seen).add(routeKey);
    const explicitParent = location.parent ? normalize(location.parent, nextSeen).location : undefined;
    return {
      pageId: page.id,
      location: normalizeResolvedLocation({
        page,
        pages: input.pages,
        resources: input.resources,
        seen,
        ...(candidate.resource ? { resource: candidate.resource } : {}),
        ...(candidate.section ? { section: candidate.section } : {}),
        ...(explicitParent ? { parent: explicitParent } : {}),
      }),
    };
  };
  return normalize(input.location, new Set());
};

export const normalizeDirectWorkbenchPageLocation = (input: {
  pageId: string;
  pages: readonly WorkbenchPageContribution[];
  resources: WorkbenchPageResourceCodec;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
}) => {
  const page = pageForId(input.pages, input.pageId);
  if (!page) throw new Error(`Unknown page: ${input.pageId}`);
  return {
    pageId: page.id,
    location: normalizeResolvedLocation({
      page,
      pages: input.pages,
      resources: input.resources,
      seen: new Set(),
      ...(input.resource ? { resource: input.resource } : {}),
      ...(input.section ? { section: input.section } : {}),
    }),
  };
};
