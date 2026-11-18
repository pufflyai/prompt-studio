import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { isPackagedRuntime } from "pstdio-paths";
import { setupLogger } from "../../lib/logger";
import { withExtensionWebviewBuildSlot } from "./extension-webview-builder";
import { runCommand } from "./install-extension-dependencies";
import { hashWebviewDependencyInputsAsync } from "./webview-dependency-inputs";

// Each guard needs a fresh resolver. Running inspection in a bounded child also keeps
// independent frontend graphs from monopolizing the orchestration worker.
export const inspectWebviewDependencyInputs = async (
  packagePath: string,
  entryPaths: string[],
  signal?: AbortSignal,
) => {
  signal?.throwIfAborted();
  if (isMainThread) return hashWebviewDependencyInputsAsync(packagePath, entryPaths);
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
      { cwd: packagePath, env, signal, stdin: JSON.stringify({ packagePath, entryPaths, timings: true }) },
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
      typeof payload.hashMs !== "number"
    ) {
      throw new Error("Invalid extension frontend input digest.");
    }
    setupLogger.info(
      {
        event: "extension.webview.dependency_timing",
        packagePath,
        queuedMs: Math.round(started - queuedAt),
        commandMs: Math.round(performance.now() - started),
        collectMs: payload.collectMs,
        hashMs: payload.hashMs,
      },
      "Measured webview dependency inspection",
    );
    return payload.digest;
  });
};
