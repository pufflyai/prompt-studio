import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readlinkSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { e2eExtensions } from "../default-extensions";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

test("diagnoses the installed Lab frontend build", async () => {
  const root = mkdtempSync(join(tmpdir(), "packaged-lab-diagnostic-"));
  let child: ChildProcess | null = null;
  try {
    const started = await startPackagedServe(root, {
      PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("workbench-fixture"),
      PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1",
    });
    child = started.child;
    const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
    const response = await fetch(`${started.baseUrl}/v1/projects`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name: "Lab build" }),
    });
    const project = (await response.json()) as { id: string };
    console.log("project", project);
    const metadataResponse = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
    const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
    const view = metadata.views.find((view) => view.localId === "lab-page");
    if (view?.body.kind !== "webview") throw new Error(JSON.stringify(metadata));
    const moduleResponse = await fetch(`${started.baseUrl}${view.body.webview.moduleUrl}`, { headers });
    const extensions = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, { headers });
    console.log("extensions", await extensions.text());
    console.log("module status", moduleResponse.status);
    const cache = join(root, "cache", "extension-webviews");
    console.log("cache", existsSync(cache) ? readdirSync(cache, { recursive: true }).slice(0, 120) : "missing");
    for (const base of [
      join(root, "extensions", "workbench-fixture"),
      resolve(import.meta.dirname, "../../../workbench-fixture"),
    ]) {
      for (const suffix of [
        "node_modules",
        "node_modules/react",
        "node_modules/react/jsx-runtime.js",
        "node_modules/@pstdio/ui",
      ]) {
        const path = join(base, suffix);
        console.log("dependency path", path, "exists", existsSync(path));
        try {
          console.log("real", realpathSync(path));
        } catch (error) {
          console.log("real error", String(error));
        }
        try {
          console.log("link", readlinkSync(path));
        } catch {}
      }
    }
    const build = await Bun.build({
      entrypoints: [join(root, "extensions", "workbench-fixture", "src", "views", "main.tsx")],
      outdir: join(root, "diagnostic-build"),
      target: "browser",
      format: "esm",
      minify: true,
      define: { "process.env.NODE_ENV": '"production"' },
      throw: false,
    });
    console.log("direct build", build.success, build.logs.map(String));
    expect(moduleResponse.status).toBe(200);
  } finally {
    if (child) await stopProcess(child);
    rmSync(root, { recursive: true, force: true });
  }
});
