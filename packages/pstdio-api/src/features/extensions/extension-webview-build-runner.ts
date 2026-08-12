import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";
import { EXTENSION_INSTALLING_MARKER } from "./install-extension-source";

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

const isSourceChanging = (sourcePath: string) => existsSync(join(sourcePath, EXTENSION_INSTALLING_MARKER));

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
  if (input.isDisposed()) return "failure";

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
    if (isSourceChanging(input.row.source_path)) return "source-changing";
    if (!input.isDisposed() && input.building.get(input.key) === input.signature) {
      await input.reportFailure(
        input.row.install_name,
        input.webviewId,
        webviewBuildFailure(input.row.install_name, input.webviewId, errorMessage(error)),
        expectedWebviewBuildSource(input.row),
      );
    }
    return "failure";
  } finally {
    input.activeBuilds.delete(controller);
  }

  if (result.success) return "success";
  if (isSourceChanging(input.row.source_path)) return "source-changing";
  if (!input.isDisposed() && input.building.get(input.key) === input.signature) {
    await input.reportFailure(
      input.row.install_name,
      input.webviewId,
      webviewBuildFailure(input.row.install_name, input.webviewId, result.details),
      expectedWebviewBuildSource(input.row),
    );
  }
  return "failure";
};
