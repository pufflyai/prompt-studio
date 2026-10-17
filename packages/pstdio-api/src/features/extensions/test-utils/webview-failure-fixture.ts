import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createDb, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { reportWebviewBuildFailure, reportWebviewBuildSuccess } from "../../../services/extension-reload";
import { loadExtensionSource } from "../extension-runtime";
import { findWebviewBuildError } from "../extension-webview-assets";
import { createExtensionWebviewBuildManager } from "../extension-webview-build-manager";
import { buildExtensionWebview } from "../extension-webview-builder";

export const setup = async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-failure-identity-"));
  const sourcePath = join(root, "extension");
  mkdirSync(sourcePath);
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "lab",
      publisher: "pstdio",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  const definition = (entry: string | null) => ({
    views: entry
      ? [
          {
            id: "page",
            title: "Page",
            body: {
              kind: "webview",
              entry: {
                kind: "package-asset",
                path: entry,
                baseUrl: pathToFileURL(join(sourcePath, "extension.ts")).href,
              },
            },
          },
        ]
      : [],
  });
  const writeDefinition = (entry: string | null) =>
    writeFileSync(join(sourcePath, "extension.ts"), `export default ${JSON.stringify(definition(entry))};`);
  writeDefinition("./main.ts");
  const entry = join(sourcePath, "main.ts");
  writeFileSync(entry, 'console.log("original bundle");');
  const database = await createDb({ path: ":memory:" });
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const successReporting = Promise.withResolvers<void>();
  const releaseSuccessReport = Promise.withResolvers<void>();
  let pauseSuccessReport = false;
  const persistLoadState = sources.updateLoadStateIfUnchanged;
  sources.updateLoadStateIfUnchanged = async (...args) => {
    if (pauseSuccessReport && args[2].loaded_revision) {
      pauseSuccessReport = false;
      successReporting.resolve();
      await releaseSuccessReport.promise;
    }
    return persistLoadState(...args);
  };
  const loaded = await loadExtensionSource(sourcePath);
  const row = await sources.register({
    install_name: "lab",
    display_name: "Lab",
    extension_id: "pstdio.lab",
    manifest_json: loaded.manifest,
    source_path: sourcePath,
    source_hash: "hash-1",
    source_kind: "local_path",
    source_ref: null,
    status: "loaded",
    version: "1.0.0",
  });
  const deps = {
    installedExtensionSourcesService: sources,
    emitInstalledSource: () => {},
    notifyInstalledSourcesChanged: async () => {},
  };
  const failed = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const reporting = Promise.withResolvers<void>();
  const releaseReport = Promise.withResolvers<void>();
  const succeeded = Promise.withResolvers<void>();
  const releaseSuccess = Promise.withResolvers<void>();
  let pauseReporting = false;
  let pauseSuccess = false;
  let reportingUnavailable = false;
  let nextLoad: (() => void) | undefined;
  const failures: Array<{ sourceHash?: string | null; sourcePath: string }> = [];
  const state = { builds: 0 };
  const beforeReport = async () => {
    if (reportingUnavailable) throw new Error("Build status storage unavailable");
    if (pauseReporting) {
      pauseReporting = false;
      reporting.resolve();
      await releaseReport.promise;
    }
  };
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: sources.list,
    loadSource: async (path) => {
      const result = await loadExtensionSource(path);
      nextLoad?.();
      nextLoad = undefined;
      return result;
    },
    reportBuildFailure: async (id, webviewId, error, expectedSource) => {
      failures.push(expectedSource);
      await beforeReport();
      return (await reportWebviewBuildFailure(deps, id, webviewId, error, expectedSource)).status;
    },
    reportBuildSuccess: async (id, webviewId, expectedSource) => {
      await beforeReport();
      return (await reportWebviewBuildSuccess(deps, id, webviewId, expectedSource)).status;
    },
    buildWebview: async (input) => {
      state.builds++;
      const outcome = await buildExtensionWebview(input);
      if (!outcome.success) {
        failed.resolve();
        await release.promise;
      } else if (pauseSuccess) {
        pauseSuccess = false;
        succeeded.resolve();
        await releaseSuccess.promise;
      }
      return outcome;
    },
    webviewCacheRoot: join(root, "cache"),
  });
  return {
    id: row.id,
    entry,
    sourcePath,
    sources,
    state,
    failures,
    failed,
    release,
    manager,
    reporting,
    releaseReport,
    succeeded,
    releaseSuccess,
    successReporting,
    releaseSuccessReport,
    pauseSuccessReport: () => {
      pauseSuccessReport = true;
    },
    pauseSuccess: () => {
      pauseSuccess = true;
    },
    setReportingUnavailable: (unavailable: boolean) => {
      reportingUnavailable = unavailable;
    },
    pauseReporting: () => {
      pauseReporting = true;
    },
    nextLoad: () =>
      new Promise<void>((resolve) => {
        nextLoad = resolve;
      }),
    adopt: async (entry: string | null, sourceHash: string) => {
      writeDefinition(entry);
      const loaded = await loadExtensionSource(sourcePath);
      await sources.updateRegistration(row.id, {
        manifest_json: loaded.manifest,
        source_hash: sourceHash,
        status: "pending",
        last_error_json: null,
      });
    },
    module: () => readFileSync(join(root, `cache/${row.id}/pstdio.lab.view.page/dist/module.js`), "utf8"),
    error: () =>
      findWebviewBuildError(
        { extensionService: { getInstalledSourceById: sources.get } },
        { installedExtensionId: row.id, webviewId: "pstdio.lab.view.page" },
      ),
    dispose: async () => {
      release.resolve();
      releaseReport.resolve();
      releaseSuccess.resolve();
      releaseSuccessReport.resolve();
      manager.dispose();
      await database.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
};
