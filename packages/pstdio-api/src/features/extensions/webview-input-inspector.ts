import { inspectWebviewDependencyInputsAsync } from "./webview-dependency-inputs";
import { isWebviewInputHints } from "./webview-input-read-ahead";

// Private compiled fast path: this module must never import the API or worker client.
export const runExtensionInputInspector = async () => {
  const input = (await Bun.stdin.json()) as {
    packagePath?: unknown;
    entryPaths?: unknown;
    timings?: unknown;
    captureHints?: unknown;
    inputHints?: unknown;
  };
  if (
    typeof input.packagePath !== "string" ||
    !Array.isArray(input.entryPaths) ||
    !input.entryPaths.every((path) => typeof path === "string") ||
    (input.inputHints !== undefined && !isWebviewInputHints(input.inputHints))
  )
    throw new Error("Invalid extension input inspection request.");
  const result = await inspectWebviewDependencyInputsAsync(input.packagePath, input.entryPaths, {
    capture: input.captureHints === true,
    prior: input.inputHints,
  });
  process.stdout.write(`${JSON.stringify(input.timings === true ? result : result.digest)}\n`);
};
