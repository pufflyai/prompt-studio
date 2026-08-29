import { buildAbsoluteApiUrl } from "@/lib/api";
import { getExtensionArtifactImageUrl, listExtensionArtifacts, readExtensionArtifactText } from "./api";

type ArtifactsReadRequest =
  | { op: "list"; mount: string; prefix?: string }
  | { op: "readText"; mount: string; path: string }
  | { op: "imageUrl"; mount: string; path: string };

interface CreateArtifactsReadCapabilityInput {
  projectId: string;
  extensionInstanceId: string;
  webviewId: string;
}

/**
 * Host side of the webview `artifacts.read` capability. The bridge gate has
 * already checked the mount grant; the API enforces mount ownership, path
 * confinement, media types, and size limits.
 */
export const createArtifactsReadCapability = (input: CreateArtifactsReadCapabilityInput) => {
  return async (params: unknown) => {
    const request = params as ArtifactsReadRequest;

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
    if (request.op === "imageUrl") {
      const { url } = await getExtensionArtifactImageUrl(
        input.projectId,
        input.extensionInstanceId,
        request.mount,
        request.path,
        input.webviewId,
      );
      return buildAbsoluteApiUrl(url);
    }

    throw new Error("Unsupported artifacts.read operation.");
  };
};
