import type { ResourceAnchor, ResourceAnchorPage, ResourceAnchorQuery, ResourceRef } from "../extensions";
import type { RequestFn } from "./request";

export interface ResourceAnchorsClient {
  addAnchors(projectId: string, resource: ResourceRef, anchors: ResourceAnchor[]): Promise<void>;
  removeAnchors(projectId: string, resource: ResourceRef, refs: ResourceRef[]): Promise<void>;
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
  listAnchors: (projectId, input) =>
    request(`/v1/projects/${encodeURIComponent(projectId)}/resource-anchors/query`, { method: "POST", body: input }),
});
