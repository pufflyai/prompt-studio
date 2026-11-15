import { hashWebviewDependencyInputsAsync } from "./webview-dependency-inputs";

// Private compiled fast path: this module must never import the API or worker client.
export const runExtensionInputInspector = async () => {
  const input = (await Bun.stdin.json()) as { packagePath?: unknown; entryPaths?: unknown };
  if (
    typeof input.packagePath !== "string" ||
    !Array.isArray(input.entryPaths) ||
    !input.entryPaths.every((path) => typeof path === "string")
  )
    throw new Error("Invalid extension input inspection request.");
  const digest = await hashWebviewDependencyInputsAsync(input.packagePath, input.entryPaths);
  process.stdout.write(`${JSON.stringify(digest)}\n`);
};
