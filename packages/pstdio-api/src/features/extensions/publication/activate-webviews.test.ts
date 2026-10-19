import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../../test-utils/create-test-app";
import { createTestExtensionSource } from "../test-utils/create-test-extension-source";
import { activatePublication } from "./activate";
import { publishedOwner } from "./catalog";
import { packExtension } from "./package";

test("published webview activation emits the completed build state and retains the immutable package identity", async () => {
  const root = await mkdtemp(join(tmpdir(), "published-webview-"));
  const app = await createTestApp({ buildWebviews: true });
  try {
    const project = await app.deps.projectService.create({ name: "Published webview" });
    const source = createTestExtensionSource({ root, installName: "webview", name: "webview", displayName: "Webview" });
    await writeFile(join(source, "view.ts"), "export const value = 1;");
    await writeFile(
      join(source, "extension.ts"),
      `export default { views: [{ id: "page", ref: { kind: "view", id: "page" }, title: "Page", body: { kind: "webview", entry: { kind: "package-asset", path: "./view.ts", baseUrl: import.meta.url } } }] };`,
    );
    const bytes = await packExtension(source);
    const asset = await app.deps.assetTransferService.stage(publishedOwner(project.id), crypto.randomUUID(), bytes);
    const emitted: { id: string; loaded_revision: string | null }[] = [];
    const stop = app.deps.eventBus.subscribe((event) => {
      if (event.table === "installed_extension_sources" && event.op === "set")
        emitted.push(event.data as (typeof emitted)[number]);
    });
    try {
      await activatePublication(
        app.deps,
        project.id,
        { extensionId: "test.webview", revision: asset.sha256, automation: false, enabled: true },
        asset,
      );
      const current = (await app.deps.extensionService.listProjectExtensionInstances(project.id))[0]!.installedSource;
      expect(current.source_ref).toBe(`pstdio-published:${asset.sha256}`);
      expect(emitted.filter((row) => row.id === current.id).at(-1)?.loaded_revision).toBe(current.loaded_revision);
    } finally {
      stop();
    }
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
