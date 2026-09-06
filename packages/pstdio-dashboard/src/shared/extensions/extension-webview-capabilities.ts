import type { WorkbenchCore } from "@pstdio/workbench";
import { toWorkbenchNavigationTarget } from "@pstdio/workbench/extensions";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import type {
  NavigationTarget,
  WebviewFilesDeleteParams,
  WebviewFilesListParams,
  WebviewFilesUploadParams,
} from "pstdio-api-contracts/extension-kernel";
import type { HostCapabilityRegistry } from "pstdio-extensions/bridge/contract";
import { createArtifactsReadCapability } from "./artifact-read-capability";
import { createExtensionFileCapabilities } from "./extension-file-capabilities";

interface CreateDashboardExtensionWebviewCapabilitiesInput {
  base: HostCapabilityRegistry;
  extensionId: string;
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
          "navigation.open": (params: unknown) => {
            const request = params as { target?: NavigationTarget };
            if (!request.target) throw new Error("navigation.open requires a target.");
            return workbench.navigation.openTarget(
              toWorkbenchNavigationTarget(request.target, { extensionId: input.extensionId }),
            );
          },
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
