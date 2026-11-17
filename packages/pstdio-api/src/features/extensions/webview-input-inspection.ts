import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { restoreRuntimeModuleImports, snapshotRuntimeModuleImports } from "pstdio-extensions/revision-dependencies";
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
    const imports = snapshotRuntimeModuleImports();
    const result = await runCommand(
      process.execPath,
      isPackagedRuntime()
        ? ["extension-input-inspector"]
        : [fileURLToPath(new URL("./webview-input-inspector.entry.ts", import.meta.url))],
      { cwd: packagePath, env, signal, stdin: JSON.stringify({ packagePath, entryPaths, imports }) },
    );
    signal?.throwIfAborted();
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "Extension frontend input inspection failed.");
    const output = JSON.parse(result.stdout) as { digest?: unknown; imports?: unknown } | null;
    if (typeof output?.digest !== "string" || !/^[a-f0-9]{64}$/.test(output.digest))
      throw new Error("Invalid extension frontend input digest.");
    restoreRuntimeModuleImports(output.imports);
    return output.digest;
  });
};
