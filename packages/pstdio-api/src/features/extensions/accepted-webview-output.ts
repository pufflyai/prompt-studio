import { preparedRevisionState, readAcceptedRevision } from "pstdio-extensions";
import { readPublishedWebviewRevision } from "pstdio-extensions/prepared-cache";
import { runExtensionPreparation } from "./extension-preparation";
import { readWebviewBuildSignature, removeUnownedWebviewBuilds } from "./extension-webview-build-cache";
import type { CreateExtensionWebviewBuildManagerInput } from "./extension-webview-build-reporters";
import type { InstalledSourceWithManifest } from "./extension-webview-build-runner";
import { expectedWebviewBuildSource } from "./extension-webview-build-runner";
import type { loadCurrentWebviewSource } from "./extension-webview-source-load";
import { resolveManagedWebviewPaths } from "./extension-webviews";

const isPublished = (distDir: string, artifactId: string) => {
  const expected = `prepared:${artifactId}`;
  return readWebviewBuildSignature(distDir) === expected && readPublishedWebviewRevision(distDir) === expected;
};

export const hasAcceptedWebviews = async (
  row: InstalledSourceWithManifest | null,
  cacheRoot: string,
  webviewId?: string,
) => {
  const accepted = row ? await readAcceptedRevision(row.source_path) : null;
  if (!row || !accepted?.webviews) return false;
  const views = accepted.webviews;
  const ids = webviewId ? [webviewId] : Object.keys(views);
  if (!ids.every((id) => views[id])) return false;
  const missing = ids.filter(
    (id) =>
      !isPublished(
        resolveManagedWebviewPaths({ installedExtensionId: row.id, webviewCacheRoot: cacheRoot, webviewId: id })
          .distDir,
        views[id]!.id,
      ),
  );
  if (!missing.length) return true;
  return runExtensionPreparation<boolean>("runtime.publish-webviews", {
    sourcePath: row.source_path,
    expectedState: preparedRevisionState(accepted),
    outputs: missing.map((id) => ({
      id,
      distDir: resolveManagedWebviewPaths({ installedExtensionId: row.id, webviewCacheRoot: cacheRoot, webviewId: id })
        .distDir,
    })),
  });
};

export const hasAcceptedNativeWebviews = async (row: InstalledSourceWithManifest | null) => {
  const accepted = row ? await readAcceptedRevision(row.source_path) : null;
  return accepted?.webviews !== undefined && Object.keys(accepted.webviews).length === 0;
};

export const notifyAcceptedWebviewPublication = async (
  report: CreateExtensionWebviewBuildManagerInput["reportPublication"],
  current: NonNullable<Awaited<ReturnType<typeof loadCurrentWebviewSource>>>,
  cacheRoot: string,
  loadCurrent: () => ReturnType<typeof loadCurrentWebviewSource>,
) => {
  if (!report) return;
  const accepted = await readAcceptedRevision(current.row.source_path);
  if (!accepted || !Object.keys(accepted.webviews ?? {}).length) return;
  const state = preparedRevisionState(accepted);
  const publicationId = `webviews:${state}`;
  while (true) {
    const latest = await loadCurrent();
    if (
      !latest ||
      latest.row.source_path !== current.row.source_path ||
      latest.row.source_hash !== current.row.source_hash ||
      latest.snapshot.loadKey !== current.snapshot.loadKey ||
      latest.snapshot.loaded.preparedRevision?.id !== accepted.id
    )
      return;
    const selected = await readAcceptedRevision(current.row.source_path);
    if (!selected || preparedRevisionState(selected) !== state) return;
    if (
      !Object.entries(selected.webviews!).every(([id, artifact]) =>
        isPublished(
          resolveManagedWebviewPaths({
            installedExtensionId: latest.row.id,
            webviewCacheRoot: cacheRoot,
            webviewId: id,
          }).distDir,
          artifact.id,
        ),
      )
    )
      return;
    if ((await report(latest.row.id, publicationId, expectedWebviewBuildSource(latest.row))) !== "source-changed")
      return;
  }
};

export const reconcileAcceptedWebviews = async (
  rows: InstalledSourceWithManifest[],
  cacheRoot: string,
  check: (id: string) => Promise<unknown>,
) => {
  removeUnownedWebviewBuilds(
    cacheRoot,
    rows.map((row) => row.id),
  );
  await Promise.all(
    rows.map(async (row) => {
      if (!(await hasAcceptedWebviews(row, cacheRoot))) await check(row.id);
    }),
  );
};
