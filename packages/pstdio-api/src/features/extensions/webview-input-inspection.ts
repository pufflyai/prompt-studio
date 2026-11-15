import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { isPackagedRuntime } from "pstdio-paths";
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
  return withExtensionWebviewBuildSlot(async () => {
    signal?.throwIfAborted();
    const env = { ...process.env };
    delete env.BUN_BE_BUN;
    const result = await runCommand(
      process.execPath,
      isPackagedRuntime()
        ? ["extension-input-inspector"]
        : [fileURLToPath(new URL("./webview-input-inspector.entry.ts", import.meta.url))],
      { cwd: packagePath, env, signal, stdin: JSON.stringify({ packagePath, entryPaths }) },
    );
    signal?.throwIfAborted();
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Extension frontend input inspection failed.");
    const digest: unknown = JSON.parse(result.stdout);
    if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))
      throw new Error("Invalid extension frontend input digest.");
    return digest;
  });
};
