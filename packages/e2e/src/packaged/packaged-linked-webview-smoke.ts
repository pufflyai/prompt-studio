import { expect, test } from "bun:test";
import type { ChildProcess } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { webviewUrl } from "../helpers/webview-origin";
import { writeExtensionWithDependency } from "./extension-fixtures";
import { runtimeAuthorization, startPackagedServe, stopProcess } from "./packaged-serve-helpers";

export const registerLinkedWebviewSmokeTests = () => {
  test("serves compiled webviews through linked package directories", async () => {
    const root = mkdtempSync(join(tmpdir(), "packaged-linked-webview-"));
    let child: ChildProcess | null = null;
    try {
      const extensionPath = writeExtensionWithDependency(root);
      const nodeModules = join(extensionPath, "node_modules");
      const store = join(root, "dependency-store");
      mkdirSync(store);
      for (const name of ["@pstdio/sdk", "test-dep"]) {
        const installed = join(nodeModules, name);
        const stored = join(store, name.replaceAll("/", "-"));
        renameSync(installed, stored);
        symlinkSync(stored, installed, "junction");
      }
      const sourceNodeModules = join(root, "source-node_modules");
      renameSync(nodeModules, sourceNodeModules);
      symlinkSync(sourceNodeModules, nodeModules, "junction");
      writeFileSync(
        join(extensionPath, "extension.ts"),
        `export default { views: [{ id: "linked", ref: { kind: "view", id: "linked" }, title: "Linked view", body: {
          kind: "webview", entry: { kind: "package-asset", path: "./src/view.ts", baseUrl: import.meta.url }
        } }] };`,
      );
      writeFileSync(
        join(extensionPath, "src", "view.ts"),
        'import { marker } from "test-dep/feature"; export default marker;',
      );
      const started = await startPackagedServe(root, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
      child = started.child;
      const headers = { ...runtimeAuthorization(started.descriptor), "content-type": "application/json" };
      const created = await fetch(`${started.baseUrl}/v1/projects`, {
        method: "POST",
        headers,
        body: JSON.stringify(folderProjectInput({ name: "Linked webview" }, root)),
      });
      expect(created.status).toBe(201);
      const project = (await created.json()) as { id: string };
      const metadataResponse = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions/ui`, { headers });
      expect(metadataResponse.status).toBe(200);
      const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
      const view = metadata.views.find((view) => view.localId === "linked");
      if (view?.body.kind !== "webview") throw new Error(JSON.stringify(metadata));
      const { originLabel } = view.body.webview;
      const moduleResponse = await fetch(webviewUrl(started.baseUrl, originLabel, view.body.webview.moduleUrl));
      const extensions = await fetch(`${started.baseUrl}/v1/projects/${project.id}/extensions`, { headers });
      expect(moduleResponse.status, await extensions.text()).toBe(200);
      const code = await moduleResponse.text();
      const module = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
      expect(module.default).toBe("loaded-via-exports-subpath");
      const modulePath = new URL(view.body.webview.moduleUrl!, started.baseUrl).pathname.split("/");
      const installedExtensionId = modulePath[5];
      const bundle = join(
        root,
        "cache/extension-webviews",
        installedExtensionId,
        "test.dep-ext.view.linked/dist/module.js",
      );
      const published = statSync(bundle).mtimeMs;
      await stopProcess(child);
      const bootStarted = performance.now();
      const restarted = await startPackagedServe(root, { PSTDIO_EXTENSION_WEBVIEW_BUILDS: "1" });
      child = restarted.child;
      const readyMs = Math.round(performance.now() - bootStarted);
      expect(statSync(bundle).mtimeMs).toBe(published);
      const restartedHeaders = runtimeAuthorization(restarted.descriptor);
      const reopened = await fetch(`${restarted.baseUrl}/v1/projects/${project.id}/extensions/ui`, {
        headers: restartedHeaders,
      });
      const reopenedMetadata = (await reopened.json()) as WorkbenchExtensionMetadata;
      const reopenedView = reopenedMetadata.views.find((view) => view.localId === "linked");
      if (reopenedView?.body.kind !== "webview") throw new Error("Missing linked webview after restart");
      const reused = await fetch(webviewUrl(restarted.baseUrl, originLabel, reopenedView.body.webview.moduleUrl));
      expect(reused.status).toBe(200);
      expect(await reused.text()).toBe(code);
      expect(statSync(bundle).mtimeMs).toBe(published);
      console.info(
        JSON.stringify({ readyMs, bundlesRewritten: 0, moduleServedMs: Math.round(performance.now() - bootStarted) }),
      );
    } finally {
      if (child) await stopProcess(child);
      rmSync(root, { recursive: true, force: true });
    }
  });
};
