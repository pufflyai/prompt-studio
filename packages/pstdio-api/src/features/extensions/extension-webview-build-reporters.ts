import type { LoadedExtension } from "./extension-runtime";
import type { InstalledSourceWithManifest } from "./extension-webview-build-runner";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";

type ExpectedWebviewBuildSource = {
  sourceHash?: string | null;
  sourcePath: string;
};

export type CreateExtensionWebviewBuildManagerInput = {
  buildWebview?: ExtensionWebviewBuilder;
  listInstalledSources: () => Promise<InstalledSourceWithManifest[]>;
  loadSource?: (sourcePath: string) => Promise<LoadedExtension>;
  onError?: (error: unknown) => void;
  reportBuildFailure: (
    installedExtensionId: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  reportBuildSuccess: (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  webviewCacheRoot?: string;
};

// Reporting is best effort: a failed report must not stop the remaining builds.
export const createBuildReporters = (input: CreateExtensionWebviewBuildManagerInput) => {
  const reportFailure = async (
    installedExtensionId: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildFailure(installedExtensionId, webviewId, error, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
    }
  };

  const reportSuccess = async (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      await input.reportBuildSuccess(installedExtensionId, webviewId, expectedSource);
      return true;
    } catch (reportError) {
      input.onError?.(reportError);
      return false;
    }
  };

  return { reportFailure, reportSuccess };
};
