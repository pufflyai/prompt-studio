import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { isPackagedRuntime } from "pstdio-paths";
import { setupLogger } from "../../lib/logger";
import { withExtensionWebviewBuildSlot } from "./extension-webview-builder";
import { runCommand } from "./install-extension-dependencies";
import { inspectWebviewDependencyInputsAsync, type WebviewInspectionReadAhead } from "./webview-dependency-inputs";
import { isWebviewReadHints } from "./webview-input-read-ahead";

// Each guard needs a fresh resolver. Running inspection in a bounded child also keeps
// independent frontend graphs from monopolizing the orchestration worker.
export const inspectWebviewDependencyInputsWithReads = async (
  packagePath: string,
  entryPaths: string[],
  signal?: AbortSignal,
  readAhead?: WebviewInspectionReadAhead,
) => {
  signal?.throwIfAborted();
  if (isMainThread) return inspectWebviewDependencyInputsAsync(packagePath, entryPaths, readAhead, signal);
  const queuedAt = performance.now();
  return withExtensionWebviewBuildSlot(async () => {
    signal?.throwIfAborted();
    const started = performance.now();
    const env = { ...process.env };
    delete env.BUN_BE_BUN;
    const result = await runCommand(
      process.execPath,
      isPackagedRuntime()
        ? ["extension-input-inspector"]
        : [fileURLToPath(new URL("./webview-input-inspector.entry.ts", import.meta.url))],
      {
        cwd: packagePath,
        env,
        signal,
        stdin: JSON.stringify({
          packagePath,
          entryPaths,
          timings: true,
          captureReads: readAhead?.capture,
          readHints: readAhead?.hints,
        }),
      },
    );
    signal?.throwIfAborted();
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Extension frontend input inspection failed.");
    const payload: unknown = JSON.parse(result.stdout);
    if (
      !payload ||
      typeof payload !== "object" ||
      !("digest" in payload) ||
      typeof payload.digest !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.digest) ||
      !("collectMs" in payload) ||
      typeof payload.collectMs !== "number" ||
      !("hashMs" in payload) ||
      typeof payload.hashMs !== "number" ||
      !("readAheadMs" in payload) ||
      typeof payload.readAheadMs !== "number"
    ) {
      throw new Error("Invalid extension frontend input digest.");
    }
    const reads = "reads" in payload ? payload.reads : undefined;
    if (reads !== undefined && !isWebviewReadHints(reads))
      throw new Error("Invalid extension frontend input read hints.");
    setupLogger.info(
      {
        event: "extension.webview.dependency_timing",
        packagePath,
        queuedMs: Math.round(started - queuedAt),
        commandMs: Math.round(performance.now() - started),
        collectMs: payload.collectMs,
        hashMs: payload.hashMs,
        readAheadMs: payload.readAheadMs,
      },
      "Measured webview dependency inspection",
    );
    return {
      digest: payload.digest,
      collectMs: payload.collectMs,
      hashMs: payload.hashMs,
      readAheadMs: payload.readAheadMs,
      reads,
    };
  });
};

export const inspectWebviewDependencyInputs = async (packagePath: string, entryPaths: string[], signal?: AbortSignal) =>
  (await inspectWebviewDependencyInputsWithReads(packagePath, entryPaths, signal)).digest;
