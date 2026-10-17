import type { ExpectedWebviewBuildSource } from "../../services/extension-reload";
import type { LoadedExtension } from "./extension-runtime";
import type { ManagedWebviewBuildResult } from "./extension-webview-build-attempt";
import type { InstalledSourceWithManifest } from "./extension-webview-build-runner";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";

export type WebviewBuildReport = "reported" | "source-changed" | "obsolete";

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
  ) => Promise<WebviewBuildReport>;
  reportBuildSuccess: (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<WebviewBuildReport>;
  webviewCacheRoot?: string;
};

// Reporting failures cannot stop the other views, but an unwritten failure is never accepted.
export const createBuildReporters = (input: CreateExtensionWebviewBuildManagerInput) => {
  const reportFailure = async (
    installedExtensionId: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      return await input.reportBuildFailure(installedExtensionId, webviewId, error, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
      return "failed" as const;
    }
  };
  const reportSuccess = async (
    installedExtensionId: string,
    webviewId: string,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    try {
      return await input.reportBuildSuccess(installedExtensionId, webviewId, expectedSource);
    } catch (reportError) {
      input.onError?.(reportError);
      return "failed" as const;
    }
  };
  const reportResult = (
    installedExtensionId: string,
    webviewId: string,
    result: Exclude<ManagedWebviewBuildResult, { status: "unavailable" }>,
    expectedSource: ExpectedWebviewBuildSource,
  ) => {
    if (result.status === "failure")
      return reportFailure(installedExtensionId, webviewId, result.error, expectedSource);
    return reportSuccess(installedExtensionId, webviewId, expectedSource);
  };
  return { reportResult };
};
