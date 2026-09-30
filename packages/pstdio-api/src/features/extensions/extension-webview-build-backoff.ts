import { createHash } from "node:crypto";
import { extensionWebviewBuildOptions } from "./extension-webview-builder";

type InstalledSourceSignatureInput = {
  source_path: string;
};

export const processKey = (installedExtensionId: string, webviewId: string) => `${installedExtensionId}\0${webviewId}`;

export const signatureFor = (
  row: InstalledSourceSignatureInput,
  webviewId: string,
  entryPath: string,
  buildInputsSignature: string,
) =>
  createHash("sha256")
    .update(
      [
        row.source_path,
        webviewId,
        entryPath,
        buildInputsSignature,
        Bun.version,
        JSON.stringify(extensionWebviewBuildOptions),
      ].join("\0"),
    )
    .digest("hex");

export const createWebviewBuildBackoff = () => {
  const failedBuilds = new Map<string, string>();

  return {
    clear: () => {
      failedBuilds.clear();
    },
    isBuildBlocked: (key: string, signature: string) => failedBuilds.get(key) === signature,
    recordBuildFailure: (key: string, signature: string) => {
      failedBuilds.set(key, signature);
    },
    recordBuildStart: (key: string) => {
      failedBuilds.delete(key);
    },
    recordBuildSuccess: (key: string) => {
      failedBuilds.delete(key);
    },
  };
};
