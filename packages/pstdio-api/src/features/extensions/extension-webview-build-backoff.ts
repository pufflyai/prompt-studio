type InstalledSourceSignatureInput = {
  source_path: string;
};

export const processKey = (installName: string, webviewId: string) => `${installName}\0${webviewId}`;

export const signatureFor = (
  row: InstalledSourceSignatureInput,
  webviewId: string,
  entryPath: string,
  buildInputsSignature: string,
) => [row.source_path, webviewId, entryPath, buildInputsSignature].join("\0");

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
