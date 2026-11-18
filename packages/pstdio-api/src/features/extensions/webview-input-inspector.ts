import { inspectWebviewDependencyInputsAsync } from "./webview-dependency-inputs";

// Private compiled fast path: this module must never import the API or worker client.
export const runExtensionInputInspector = async () => {
  const input = (await Bun.stdin.json()) as { packagePath?: unknown; entryPaths?: unknown; timings?: unknown };
  if (
    typeof input.packagePath !== "string" ||
    !Array.isArray(input.entryPaths) ||
    !input.entryPaths.every((path) => typeof path === "string")
  )
    throw new Error("Invalid extension input inspection request.");
  const result = await inspectWebviewDependencyInputsAsync(input.packagePath, input.entryPaths);
  process.stdout.write(`${JSON.stringify(input.timings === true ? result : result.digest)}\n`);
};
