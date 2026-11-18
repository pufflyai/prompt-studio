import { inspectWebviewDependencyInputsAsync } from "./webview-dependency-inputs";
import { isWebviewReadHints } from "./webview-input-read-ahead";

// Private compiled fast path: this module must never import the API or worker client.
export const runExtensionInputInspector = async () => {
  const input = (await Bun.stdin.json()) as {
    packagePath?: unknown;
    entryPaths?: unknown;
    timings?: unknown;
    captureReads?: unknown;
    readHints?: unknown;
  };
  if (
    typeof input.packagePath !== "string" ||
    !Array.isArray(input.entryPaths) ||
    !input.entryPaths.every((path) => typeof path === "string") ||
    (input.readHints !== undefined && !isWebviewReadHints(input.readHints))
  )
    throw new Error("Invalid extension input inspection request.");
  const result = await inspectWebviewDependencyInputsAsync(input.packagePath, input.entryPaths, {
    capture: input.captureReads === true,
    hints: input.readHints,
  });
  process.stdout.write(`${JSON.stringify(input.timings === true ? result : result.digest)}\n`);
};
