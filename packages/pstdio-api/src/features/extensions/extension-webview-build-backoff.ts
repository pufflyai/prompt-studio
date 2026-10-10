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

// Holds the inputs of each failed attempt, so the same inputs are not tried again. Builds use a
// webview's process key; source loads use the installed extension id.
export const createWebviewBuildBackoff = () => {
  const failures = new Map<string, string>();

  return {
    clear: () => {
      failures.clear();
    },
    forget: (key: string) => {
      failures.delete(key);
    },
    isBlocked: (key: string, signature: string) => failures.get(key) === signature,
    recordFailure: (key: string, signature: string) => {
      failures.set(key, signature);
    },
  };
};
