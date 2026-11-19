import type { ChangeIndicator, ObservedResource } from "pstdio-api-contracts";
import type { ResourceRef } from "../extensions";
import type { RequestFn } from "./request";

export const createResourceChangesClient = (request: RequestFn) => {
  const post = <T>(projectId: string, operation: string, body: object, signal?: AbortSignal) =>
    request<T>(`/v1/projects/${encodeURIComponent(projectId)}/resource-changes/${operation}`, {
      method: "POST",
      body,
      signal,
    });
  return {
    query: (projectId: string, resources: ResourceRef[], signal?: AbortSignal) =>
      post<ChangeIndicator[]>(projectId, "query", { resources }, signal),
    read: (projectId: string, resource: ResourceRef, signal?: AbortSignal) =>
      post<ObservedResource>(projectId, "read", { resource }, signal),
    acknowledge: (projectId: string, receipt: string, signal?: AbortSignal, resource?: ResourceRef) =>
      post<ChangeIndicator>(projectId, "acknowledge", { receipt, resource }, signal),
  };
};
