import type {
  FileRendererSectionTarget,
  PageLocation,
  PageRef,
  ResourceRef,
} from "pstdio-api-contracts/extension-kernel";
import { defaultPageResourceCodec } from "./page-resource-codec";

export interface PageUrlDefinition {
  id: string;
  ref: PageRef;
  path: string;
}
export interface PageResourceCodec {
  normalize(resource: ResourceRef): ResourceRef;
  toUri(resource: ResourceRef): string;
  fromUri(uri: string): ResourceRef | undefined;
}

const hostExtensionId = "pstdio";

const pageRefKey = (ref: PageRef) => `${ref.extensionId ?? ""}:page:${ref.id}`;

const pageForRef = (pages: readonly PageUrlDefinition[], ref: PageRef) =>
  pages.find((page) => pageRefKey(page.ref) === pageRefKey(ref));

const encodePath = (path: string) =>
  path
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const routePath = (projectId: string, page: PageUrlDefinition) => {
  const project = `/projects/${encodeURIComponent(projectId)}`;
  const path = encodePath(page.path);
  if (page.ref.extensionId === hostExtensionId) return path ? `${project}/${path}` : project;
  if (!page.ref.extensionId) throw new Error(`Page "${page.id}" has no extension id`);
  return `${project}/extensions/${encodeURIComponent(page.ref.extensionId)}/${path}`;
};

const normalizedSection = (value: unknown): FileRendererSectionTarget | undefined => {
  if (!value || typeof value !== "object" || !Array.isArray((value as { anchors?: unknown }).anchors)) return undefined;
  const anchors = (value as { anchors: unknown[] }).anchors;
  if (
    anchors.some(
      (anchor) =>
        !anchor ||
        typeof anchor !== "object" ||
        typeof (anchor as { id?: unknown }).id !== "string" ||
        typeof (anchor as { heading?: unknown }).heading !== "string" ||
        ((anchor as { occurrence?: unknown }).occurrence !== undefined &&
          (!Number.isInteger((anchor as { occurrence?: unknown }).occurrence) ||
            Number((anchor as { occurrence?: unknown }).occurrence) < 0)),
    )
  ) {
    return undefined;
  }
  return {
    anchors: anchors.map((anchor) => {
      const value = anchor as { id: string; heading: string; occurrence?: number };
      return {
        id: value.id,
        heading: value.heading,
        ...(value.occurrence !== undefined ? { occurrence: value.occurrence } : {}),
      };
    }),
  };
};

const serializeSection = (section: FileRendererSectionTarget) => {
  const normalized = normalizedSection(section);
  if (!normalized) throw new Error("Page location has an invalid section");
  return JSON.stringify(normalized);
};

const parseSection = (value: string) => {
  try {
    return normalizedSection(JSON.parse(value));
  } catch {
    return undefined;
  }
};

export const serializeWorkbenchPageUrl = (input: {
  projectId: string;
  location: PageLocation;
  pages: readonly PageUrlDefinition[];
  resources: PageResourceCodec;
}) => {
  const page = pageForRef(input.pages, input.location.page);
  if (!page) throw new Error(`Unknown page ref: ${pageRefKey(input.location.page)}`);
  const query = new URLSearchParams();
  if (input.location.resource) {
    query.set("resource", input.resources.toUri(input.resources.normalize(input.location.resource)));
  }
  if (input.location.section) query.set("section", serializeSection(input.location.section));
  const encoded = query.toString();
  const path = routePath(input.projectId, page);
  return encoded ? `${path}?${encoded}` : path;
};

const decodedSegments = (pathname: string) => {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));
  } catch {
    return undefined;
  }
};

export const isWorkbenchProjectUrl = (urlValue: string, projectId: string) => {
  try {
    const url = new URL(urlValue, "http://workbench.local");
    const segments = decodedSegments(url.pathname);
    return Boolean(segments && segments[0] === "projects" && segments[1] === projectId);
  } catch {
    return false;
  }
};

const pageForRoute = (pages: readonly PageUrlDefinition[], extensionId: string, path: string) =>
  pages.find((page) => page.ref.extensionId === extensionId && page.path === path);

const parseResource = (uri: string, resources: PageResourceCodec): ResourceRef | undefined => {
  try {
    const resource = resources.fromUri(uri);
    return resource ? resources.normalize(resource) : undefined;
  } catch {
    return undefined;
  }
};

export interface ParsedWorkbenchPageUrl {
  pageId: string;
  resource?: ResourceRef;
  section?: FileRendererSectionTarget;
}

export const parseWorkbenchPageUrl = (input: {
  url: string;
  projectId: string;
  pages: readonly PageUrlDefinition[];
  resources: PageResourceCodec;
}): ParsedWorkbenchPageUrl | undefined => {
  let url: URL;
  try {
    url = new URL(input.url, "http://workbench.local");
  } catch {
    return undefined;
  }
  const segments = decodedSegments(url.pathname);
  if (!segments || segments[0] !== "projects" || segments[1] !== input.projectId) return undefined;
  const route = segments.slice(2);
  const extensionRoute = route[0] === "extensions";
  const extensionId = extensionRoute ? route[1] : hostExtensionId;
  const path = (extensionRoute ? route.slice(2) : route).join("/");
  if (!extensionId || (extensionRoute && !path)) return undefined;
  const page = pageForRoute(input.pages, extensionId, path);
  if (!page) return undefined;

  const resourceValue = url.searchParams.get("resource");
  const resource = resourceValue ? parseResource(resourceValue, input.resources) : undefined;
  if (resourceValue && !resource) return undefined;
  const sectionValue = url.searchParams.get("section");
  const section = sectionValue ? parseSection(sectionValue) : undefined;
  if (sectionValue && !section) return undefined;
  return {
    pageId: page.id,
    ...(resource ? { resource } : {}),
    ...(section ? { section } : {}),
  };
};

/** Serialize a project page using the same resource encoding as the dashboard. */
export const serializePageUrl = (input: { projectId: string; page: PageUrlDefinition; resource?: ResourceRef }) =>
  serializeWorkbenchPageUrl({
    projectId: input.projectId,
    location: { page: input.page.ref, resource: input.resource },
    pages: [input.page],
    resources: defaultPageResourceCodec,
  });

/** Resolve a dashboard URL against the caller's declared pages and project. */
export const parsePageUrl = (input: { url: string; projectId: string; pages: readonly PageUrlDefinition[] }) => {
  if (!input.url.startsWith("/") || input.url.startsWith("//")) return undefined;
  return parseWorkbenchPageUrl({ ...input, resources: defaultPageResourceCodec });
};
