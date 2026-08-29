import type { WorkbenchCore } from "@pstdio/workbench";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
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

interface CreateDashboardSettingsWebviewFileCapabilitiesInput {
  metadata: Pick<WorkbenchExtensionMetadata, "extensions" | "settingsPanels">;
  projectId: string;
  webviewId: string;
}

const fileCapabilityRegistry = (files: ReturnType<typeof createExtensionFileCapabilities>) =>
  ({
    "files.upload": (params: unknown) => files.upload(params as WebviewFilesUploadParams),
    "files.list": (params: unknown) => files.list(params as WebviewFilesListParams),
    "files.delete": (params: unknown) => files.delete(params as WebviewFilesDeleteParams),
  }) satisfies HostCapabilityRegistry;

export const createDashboardSettingsWebviewFileCapabilities = (
  input: CreateDashboardSettingsWebviewFileCapabilitiesInput,
) => {
  const panel = input.metadata.settingsPanels.find(
    (candidate) => candidate.id === input.webviewId && candidate.slot.id === "project.settingsPanels",
  );
  const extension = input.metadata.extensions.find((candidate) => candidate.id === panel?.extensionId);
  if (!extension?.extensionInstanceId) return {};

  return fileCapabilityRegistry(
    createExtensionFileCapabilities({
      extensionInstanceId: extension.extensionInstanceId,
      projectId: input.projectId,
    }),
  );
};

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
          ...fileCapabilityRegistry(files),
          "artifacts.read": createArtifactsReadCapability({ ...owner, webviewId: input.webviewId }),
        }
      : {}),
  } satisfies HostCapabilityRegistry;
};
