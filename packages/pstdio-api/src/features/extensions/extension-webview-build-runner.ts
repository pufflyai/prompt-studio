import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionWebviewBuilder } from "./extension-webview-builder";
import { EXTENSION_INSTALLING_MARKER } from "./install-extension-source";

export type InstalledSourceWithManifest = {
  id: string;
  install_name: string;
  updated_at: string;
  source_hash?: string | null;
  source_path: string;
};

export const expectedWebviewBuildSource = (row: InstalledSourceWithManifest) => ({
  sourceHash: row.source_hash,
  sourcePath: row.source_path,
  updatedAt: row.updated_at,
});

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));
const isSourceChanging = (sourcePath: string) => existsSync(join(sourcePath, EXTENSION_INSTALLING_MARKER));
export const webviewBuildFailure = (installName: string, webviewId: string, details: string) =>
  new Error(`Webview build failed for ${installName}/${webviewId}${details ? `: ${details}` : ""}`);

export const runExtensionWebviewBuild = async (input: {
  activeBuilds: Set<AbortController>;
  buildWebview: ExtensionWebviewBuilder;
  distDir: string;
  entryPath: string;
  isCurrent: () => boolean;
  row: InstalledSourceWithManifest;
  signal?: AbortSignal;
  webviewId: string;
}) => {
  if (!input.isCurrent()) return { status: "unavailable" as const };
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (input.signal?.aborted) controller.abort();
  else input.signal?.addEventListener("abort", abort, { once: true });
  input.activeBuilds.add(controller);
  try {
    const result = await input.buildWebview({
      entryPath: input.entryPath,
      outdir: input.distDir,
      signal: controller.signal,
    });
    if (result.success) return { status: "success" as const };
    if (!input.isCurrent() || isSourceChanging(input.row.source_path)) return { status: "unavailable" as const };
    return {
      status: "failure" as const,
      error: webviewBuildFailure(input.row.install_name, input.webviewId, result.details),
    };
  } catch (error) {
    if (!input.isCurrent() || isSourceChanging(input.row.source_path)) return { status: "unavailable" as const };
    return {
      status: "failure" as const,
      error: webviewBuildFailure(input.row.install_name, input.webviewId, errorMessage(error)),
    };
  } finally {
    input.signal?.removeEventListener("abort", abort);
    input.activeBuilds.delete(controller);
  }
};
