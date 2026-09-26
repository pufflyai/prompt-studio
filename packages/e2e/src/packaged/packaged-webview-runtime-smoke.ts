import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const expectPackagedWebviewRuntime = async (baseUrl: string, metadata: WorkbenchExtensionMetadata) => {
  const view = metadata.views.find((candidate) => candidate.body.kind === "webview");
  if (!view || view.body.kind !== "webview") throw new Error("Expected a packaged webview");
  const response = await fetch(new URL(view.body.webview.runtimeUrl, baseUrl));
  expect(response.status).toBe(200);
  const script = (await response.text()).match(/<script>([\s\S]*?)<\/script>/)?.[1];
  expect(script).toBeDefined();
  const runtime = new Bun.Transpiler({ loader: "js" }).scan(script!);
  // The runtime must boot without private workspace packages or an import map.
  expect(runtime.imports.filter((entry) => entry.kind !== "dynamic-import")).toEqual([]);
};
