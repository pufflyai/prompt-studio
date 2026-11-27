import { expect } from "bun:test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

export const inlineRuntimeScript = (html: string) => html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i)?.[1];

export const expectPackagedWebviewRuntime = async (baseUrl: string, metadata: WorkbenchExtensionMetadata) => {
  const view = metadata.views.find((candidate) => candidate.body.kind === "webview");
  if (!view || view.body.kind !== "webview") throw new Error("Expected a packaged webview");
  const runtimeUrl = new URL(view.body.webview.runtimeUrl, baseUrl);
  const response = await fetch(runtimeUrl);
  expect(response.status).toBe(200);
  const html = await response.text();
  const preload = html.match(/<link rel="modulepreload" href="([^"]+)"/)?.[1];
  expect(preload).toBeDefined();
  expect(new URL(preload!, runtimeUrl).href).toBe(new URL(view.body.webview.moduleUrl, baseUrl).href);
  const script = inlineRuntimeScript(html);
  expect(script).toBeDefined();
  const runtime = new Bun.Transpiler({ loader: "js" }).scan(script!);
  // The runtime must boot without private workspace packages or an import map.
  expect(runtime.imports.filter((entry) => entry.kind !== "dynamic-import")).toEqual([]);
};
