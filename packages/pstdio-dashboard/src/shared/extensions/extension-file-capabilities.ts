import type {
  ExtensionBlobRef,
  WebviewFileScope,
  WebviewFilesDeleteParams,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
} from "pstdio-api-contracts/extension-kernel";
import { apiRequest } from "@/lib/api";

interface RequestOptions {
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
}

type ExtensionFileRequest = <T>(path: string, options?: RequestOptions) => Promise<T>;

interface CreateExtensionFileCapabilitiesInput {
  extensionInstanceId: string;
  projectId: string;
  request?: ExtensionFileRequest;
}

const scopeQuery = (scope: WebviewFileScope | undefined) => {
  if (!scope) return "";
  const query = new URLSearchParams({ scope_type: scope.type });
  if ("id" in scope && scope.id) query.set("scope_id", scope.id);
  return `?${query.toString()}`;
};

export const createExtensionFileCapabilities = (input: CreateExtensionFileCapabilitiesInput) => {
  const request = input.request ?? apiRequest;
  const collectionPath = `/v1/projects/${encodeURIComponent(input.projectId)}/extensions/${encodeURIComponent(input.extensionInstanceId)}/files`;

  return {
    upload: (params: WebviewFilesUploadParams) =>
      request<ExtensionBlobRef>(`${collectionPath}${scopeQuery(params.scope)}`, {
        method: "POST",
        body: params.data,
        headers: {
          "content-type": params.mimeType ?? "application/octet-stream",
          "x-file-name": encodeURIComponent(params.name),
        },
      }),
    list: (params: WebviewFilesListParams) =>
      request<{ files: ExtensionBlobRef[] }>(`${collectionPath}${scopeQuery(params.scope)}`),
    delete: (params: WebviewFilesDeleteParams) =>
      request<void>(`${collectionPath}/${encodeURIComponent(params.id)}`, { method: "DELETE" }),
  };
};
