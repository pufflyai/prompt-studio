import type { WorkbenchCore } from "@pstdio/workbench";
import type {
  WebviewFilesDeleteParams,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
  WebviewResourceOpenParams,
} from "pstdio-api-contracts/extension-kernel";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { createArtifactsReadCapability } from "./artifact-read-capability";
import { openWebviewResource } from "./components/extension-webview-command";
import { createExtensionFileCapabilities } from "./extension-file-capabilities";

interface CreateDashboardExtensionWebviewCapabilitiesInput {
  base: HostCapabilityRegistry;
  extensionInstanceId?: string;
  projectId?: string;
  webviewId: string;
  workbench?: WorkbenchCore;
}

export const createDashboardExtensionWebviewCapabilities = (
  input: CreateDashboardExtensionWebviewCapabilitiesInput,
) => {
  const owner =
    input.projectId && input.extensionInstanceId
      ? { projectId: input.projectId, extensionInstanceId: input.extensionInstanceId }
      : undefined;
  const files = owner ? createExtensionFileCapabilities(owner) : undefined;
  const workbench = input.workbench;

  return {
    ...input.base,
    ...(workbench
      ? {
          "resource.open": (params: unknown) => openWebviewResource(workbench, params as WebviewResourceOpenParams),
        }
      : {}),
    ...(owner && files
      ? {
          "files.upload": (params: unknown) => files.upload(params as WebviewFilesUploadParams),
          "files.list": (params: unknown) => files.list(params as WebviewFilesListParams),
          "files.delete": (params: unknown) => files.delete(params as WebviewFilesDeleteParams),
          "artifacts.read": createArtifactsReadCapability({ ...owner, webviewId: input.webviewId }),
        }
      : {}),
  } satisfies HostCapabilityRegistry;
};
