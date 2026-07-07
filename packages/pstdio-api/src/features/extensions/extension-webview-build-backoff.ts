type InstalledSourceSignatureInput = {
  install_name: string;
  source_hash?: string | null;
  source_path: string;
};

export const processKey = (installName: string, webviewId: string) => `${installName}\0${webviewId}`;

export const signatureFor = (row: InstalledSourceSignatureInput, webviewId: string, entryPath: string) =>
  [row.source_path, row.source_hash ?? "", webviewId, entryPath].join("\0");

export const sourceSignatureFor = (row: InstalledSourceSignatureInput) =>
  [row.source_path, row.source_hash ?? ""].join("\0");

export const createWebviewBuildBackoff = () => {
  const failedBuilds = new Map<string, string>();
  const failedSources = new Map<string, string>();

  return {
    clear: () => {
      failedBuilds.clear();
      failedSources.clear();
    },
    isBuildBlocked: (key: string, signature: string) => failedBuilds.get(key) === signature,
    isSourceBlocked: (installName: string, signature: string) => failedSources.get(installName) === signature,
    recordBuildFailure: (key: string, signature: string) => {
      failedBuilds.set(key, signature);
    },
    recordBuildStart: (key: string) => {
      failedBuilds.delete(key);
    },
    recordBuildSuccess: (key: string) => {
      failedBuilds.delete(key);
    },
    recordSourceFailure: (installName: string, signature: string) => {
      failedSources.set(installName, signature);
    },
    recordSourceSuccess: (installName: string) => {
      failedSources.delete(installName);
    },
  };
};
