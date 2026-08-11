import type { ExtensionWebviewBuilder } from "./extension-webview-builder";

export type InstalledSourceWithManifest = {
  install_name: string;
  source_hash?: string | null;
  source_path: string;
};

type ExpectedWebviewBuildSource = {
  sourceHash?: string | null;
  sourcePath: string;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const webviewBuildFailure = (installName: string, webviewId: string, details: string) =>
  new Error(`Webview build failed for ${installName}/${webviewId}${details ? `: ${details}` : ""}`);

export const expectedWebviewBuildSource = (row: InstalledSourceWithManifest) => ({
  sourceHash: row.source_hash,
  sourcePath: row.source_path,
});

export const runExtensionWebviewBuild = async (input: {
  activeBuilds: Set<AbortController>;
  building: Map<string, string>;
  buildWebview: ExtensionWebviewBuilder;
  distDir: string;
  entryPath: string;
  isDisposed: () => boolean;
  key: string;
  reportFailure: (
    installName: string,
    webviewId: string,
    error: unknown,
    expectedSource: ExpectedWebviewBuildSource,
  ) => Promise<unknown>;
  row: InstalledSourceWithManifest;
  signature: string;
  webviewId: string;
}) => {
  if (input.isDisposed()) return false;

  const controller = new AbortController();
  input.activeBuilds.add(controller);
  let result: Awaited<ReturnType<ExtensionWebviewBuilder>>;
  try {
    result = await input.buildWebview({
      entryPath: input.entryPath,
      outdir: input.distDir,
      signal: controller.signal,
    });
  } catch (error) {
    if (!input.isDisposed() && input.building.get(input.key) === input.signature) {
      await input.reportFailure(
        input.row.install_name,
        input.webviewId,
        webviewBuildFailure(input.row.install_name, input.webviewId, errorMessage(error)),
        expectedWebviewBuildSource(input.row),
      );
    }
    return false;
  } finally {
    input.activeBuilds.delete(controller);
  }

  if (result.success) return true;
  if (!input.isDisposed() && input.building.get(input.key) === input.signature) {
    await input.reportFailure(
      input.row.install_name,
      input.webviewId,
      webviewBuildFailure(input.row.install_name, input.webviewId, result.details),
      expectedWebviewBuildSource(input.row),
    );
  }
  return false;
};
