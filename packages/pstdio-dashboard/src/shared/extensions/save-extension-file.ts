import type { WebviewFilesDownloadParams, WebviewFilesSaveResult } from "pstdio-api-contracts/extension-kernel";
import { downloadExtensionFile } from "./download-extension-file";

interface DesktopFileBridge {
  saveFile(input: WebviewFilesDownloadParams): Promise<WebviewFilesSaveResult>;
}

export const saveExtensionFile = async (
  input: WebviewFilesDownloadParams,
  bridge: unknown = (globalThis as { promptStudioDesktop?: unknown }).promptStudioDesktop,
) => {
  if (bridge !== undefined) {
    if (!bridge || typeof bridge !== "object" || !("saveFile" in bridge) || typeof bridge.saveFile !== "function")
      throw new Error("Update Prompt Studio to save this file, then try again.");
    return (bridge as DesktopFileBridge).saveFile(input);
  }
  downloadExtensionFile(input);
  return { status: "initiated" as const };
};
