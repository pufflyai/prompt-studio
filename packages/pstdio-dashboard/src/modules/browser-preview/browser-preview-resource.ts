import type { ResourceRef } from "@pstdio/workbench";
import { type BrowserPreviewUrlPolicy, normalizeBrowserPreviewUrl } from "./browser-preview-url";
import { type BrowserPreviewViewport, normalizeBrowserPreviewViewport } from "./browser-preview-viewport";

export const browserPreviewResourceKind = "browser-preview";

export interface BrowserPreviewMetadata extends Record<string, unknown> {
  projectId: string;
  previewId: string;
  url?: string;
  viewport: BrowserPreviewViewport;
}

export interface CreateBrowserPreviewResourceInput {
  projectId: string;
  previewId?: string;
  url?: string;
  viewport?: BrowserPreviewViewport;
}

const createPreviewId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export const createBrowserPreviewUri = (projectId: string, previewId: string) =>
  `dashboard-workbench://browser-preview/${encodeURIComponent(projectId)}/${previewId}`;

export const normalizeBrowserPreviewMetadata = (
  value: unknown,
  urlPolicy: BrowserPreviewUrlPolicy = {},
): BrowserPreviewMetadata | undefined => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (typeof record.projectId !== "string" || typeof record.previewId !== "string") return undefined;
  const normalizedUrl = typeof record.url === "string" ? normalizeBrowserPreviewUrl(record.url, urlPolicy) : undefined;
  const url = normalizedUrl?.ok ? normalizedUrl.url : undefined;

  return {
    projectId: record.projectId,
    previewId: record.previewId,
    ...(url ? { url } : {}),
    viewport: normalizeBrowserPreviewViewport(record.viewport),
  };
};

export const createBrowserPreviewResource = (input: CreateBrowserPreviewResourceInput) => {
  const previewId = input.previewId ?? createPreviewId();
  const metadata: BrowserPreviewMetadata = {
    projectId: input.projectId,
    previewId,
    ...(input.url ? { url: input.url } : {}),
    viewport: normalizeBrowserPreviewViewport(input.viewport),
  };

  return {
    kind: browserPreviewResourceKind,
    id: previewId,
    uri: createBrowserPreviewUri(input.projectId, previewId),
    label: input.url ?? "Browser",
    icon: "PanelTop",
    metadata,
  } satisfies ResourceRef;
};

export const updateBrowserPreviewResource = (
  resource: ResourceRef,
  updates: { url?: string; viewport?: BrowserPreviewViewport },
) => {
  const metadata =
    normalizeBrowserPreviewMetadata(resource.metadata) ??
    ({
      projectId: "unknown",
      previewId: resource.id ?? resource.uri,
      viewport: { mode: "responsive" },
    } satisfies BrowserPreviewMetadata);

  return {
    ...resource,
    label: updates.url ?? metadata.url ?? "Browser",
    metadata: {
      ...metadata,
      ...(updates.url !== undefined ? { url: updates.url } : {}),
      viewport: normalizeBrowserPreviewViewport(updates.viewport ?? metadata.viewport),
    },
  } satisfies ResourceRef;
};
