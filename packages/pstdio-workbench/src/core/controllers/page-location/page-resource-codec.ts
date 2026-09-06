import type { WorkbenchPageResourceCodec } from "../../registries/pages/page-registry-types";

const fromUri = (uri: string) => {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "pstdio:" || parsed.hostname !== "extension-resource") return undefined;
    const [type, id, ...rest] = parsed.pathname.slice(1).split("/");
    if (!type || !id || rest.length > 0) return undefined;
    const extensionId = parsed.searchParams.get("extensionId");
    const projectId = parsed.searchParams.get("projectId");
    return {
      type: decodeURIComponent(type),
      id: decodeURIComponent(id),
      ...(extensionId ? { extensionId } : {}),
      ...(projectId ? { projectId } : {}),
    };
  } catch {
    return undefined;
  }
};

/** Resource URI conversion belongs to route and persistence adapters. */
export const defaultPageResourceCodec: WorkbenchPageResourceCodec = {
  normalize: (resource) => ({ ...resource }),
  toUri: (resource) => {
    const uri = `pstdio://extension-resource/${encodeURIComponent(resource.type)}/${encodeURIComponent(resource.id)}`;
    const query = new URLSearchParams();
    if (resource.extensionId) query.set("extensionId", resource.extensionId);
    if (resource.projectId) query.set("projectId", resource.projectId);
    return query.size ? `${uri}?${query}` : uri;
  },
  fromUri,
};
