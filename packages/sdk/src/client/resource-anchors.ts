import type { Page } from "pstdio-api-contracts";
import type { ResourceAnchor, ResourceAnchorPage, ResourceAnchorQuery, ResourceRef } from "../extensions";
import type { RequestFn } from "./request";

export interface ResourceAnchorsClient {
  addAnchors(projectId: string, resource: ResourceRef, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(projectId: string, resource: ResourceRef, refs: ResourceRef[]): Promise<void>;
  queryAnchors(projectId: string, input: ResourceAnchorQuery): Promise<Page<ResourceAnchorPage["items"][number]>>;
  /** @deprecated Use queryAnchors for the required nullable cursor contract. */
  listAnchors(projectId: string, input: ResourceAnchorQuery): Promise<ResourceAnchorPage>;
}

export const createResourceAnchorsClient = (request: RequestFn): ResourceAnchorsClient => ({
  addAnchors: async (projectId, resource, anchors) => {
    await request(`/v1/projects/${encodeURIComponent(projectId)}/resource-anchors/add`, {
      method: "POST",
      body: { resource, anchors },
    });
  },
  removeAnchors: async (projectId, resource, refs) => {
    await request(`/v1/projects/${encodeURIComponent(projectId)}/resource-anchors/remove`, {
      method: "POST",
      body: { resource, refs },
    });
  },
  queryAnchors: async (projectId, input) => {
    const page = await request<Page<ResourceAnchorPage["items"][number]>>(
      `/v1/projects/${encodeURIComponent(projectId)}/resource-anchors/query-page`,
      { method: "POST", body: input },
    );
    return { ...page, nextCursor: page.nextCursor ?? null };
  },
  listAnchors: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/resource-anchors/query`, { method: "POST", body: input }),
});
