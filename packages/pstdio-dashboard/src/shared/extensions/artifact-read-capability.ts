import type { WebviewArtifactsReadParams } from "@pstdio/sdk/extensions";
import { buildAbsoluteApiUrl } from "@/lib/api";
import { getExtensionArtifactImageUrl, listExtensionArtifacts, readExtensionArtifactText } from "./api";

interface CreateArtifactsReadAdapterInput {
  projectId: string;
  extensionInstanceId: string;
  webviewId: string;
}

/**
 * Host side of the webview `artifacts.read` capability. The bridge gate has
 * already checked the mount grant; the API enforces mount ownership, path
 * confinement, media types, and size limits.
 */
export const createArtifactsReadAdapter = (input: CreateArtifactsReadAdapterInput) => {
  return async (request: WebviewArtifactsReadParams) => {
    if (request.op === "list") {
      const { files } = await listExtensionArtifacts(
        input.projectId,
        input.extensionInstanceId,
        request.mount,
        request.prefix,
      );
      return files;
    }
    if (request.op === "readText") {
      const { content } = await readExtensionArtifactText(
        input.projectId,
        input.extensionInstanceId,
        request.mount,
        request.path,
      );
      return content;
    }
    const { url } = await getExtensionArtifactImageUrl(
      input.projectId,
      input.extensionInstanceId,
      request.mount,
      request.path,
      input.webviewId,
    );
    return buildAbsoluteApiUrl(url);
  };
};
