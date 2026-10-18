import type { ExtensionClient } from "@pstdio/sdk/client";
import type {
  WebviewFilesDeleteParams,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
} from "pstdio-api-contracts/extension-kernel";
import { getApiClient } from "@/lib/api";

interface CreateExtensionFileCapabilitiesInput {
  extensionInstanceId: string;
  projectId: string;
  files?: ExtensionClient["files"];
}

export const createExtensionFileCapabilities = (input: CreateExtensionFileCapabilitiesInput) => {
  const files = input.files ?? getApiClient().extensions.files;
  return {
    upload: (params: WebviewFilesUploadParams) => files.upload(input.projectId, input.extensionInstanceId, params),
    list: (params: WebviewFilesListParams) => files.list(input.projectId, input.extensionInstanceId, params),
    delete: (params: WebviewFilesDeleteParams) => files.delete(input.projectId, input.extensionInstanceId, params.id),
  };
};
