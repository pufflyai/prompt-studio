import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { packageAsset, viewDataEvents } from "pstdio-api-contracts/extension-kernel";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeExtension } from "./default-extensions-test-fixtures";
import { createProjectExtensionLifecycle } from "./project-extension-lifecycle";

test("only enabled project setup is offered, honoring its shared device visibility preference", async () => {
  const root = await mkdtemp(join(tmpdir(), "project-setup-"));
  const previous = process.env.PSTDIO_DEFAULT_EXTENSIONS;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const source = join(root, "source");
  writeExtension(source, "setup");
  await writeFile(join(source, "view.html"), "<html><body>Setup</body></html>");
  await writeFile(
    join(source, "extension.ts"),
    `export default {
    projectSetup: { view: { kind: "view", id: "setup" }, hiddenSetting: "hidden" },
    views: [{ id: "setup", ref: { kind: "view", id: "setup" }, title: "Setup", body: { kind: "webview", entry: ${JSON.stringify(packageAsset("./view.html", pathToFileURL(join(source, "extension.ts")).href))} } }],
    settings: { properties: {
      hidden: { type: "boolean", scope: "device", default: false },
      projectValue: { type: "number", scope: "project", default: 0 },
      globalValue: { type: "number", scope: "global", default: 0 }
    } }
  };`,
  );
  const handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  let stopCatalog = () => {};
  try {
    const { app, deps } = handle;
    const a = await deps.projectService.create({ name: "First" });
    const b = await deps.projectService.create({ name: "Next" });
    const enable = (projectId: string) =>
      deps.extensionService.enableInstalledSourceForProject({
        projectId,
        installName: "setup",
        extensionId: "pstdio.setup",
        name: "setup",
        displayName: "Setup",
        manifest: {},
        sourcePath: source,
      });
    const first = await enable(a.id);
    await enable(b.id);
    const metadata = async (id: string) => {
      const response = await app.request(`/v1/projects/${id}/extensions/ui`);
      expect(response.status).toBe(200);
      return response.json();
    };
    expect((await metadata(a.id)).projectSetups).toHaveLength(1);
    const snapshot = await deps.extensionRuntimeCatalog.get(a.id);
    const definitions = (await metadata(a.id)).settingsDefinitions;
    const context = {
      extensionId: "pstdio.setup",
      extensionInstanceId: first.instance.id,
      installedExtensionId: first.installedSource.id,
      definitions,
    };
    const catalogEvents: unknown[] = [];
    stopCatalog = deps.eventBus.subscribe((event) => {
      const data = event.data as { eventId?: string };
      if (event.table === "extension_events" && data.eventId === viewDataEvents.extensionCatalogChanged.id)
        catalogEvents.push(data);
    });
    await deps.extensionSettingsService.get(context, "hidden");
    await expect(deps.extensionSettingsService.set(context, "hidden", "invalid")).rejects.toThrow();
    await deps.extensionSettingsService.delete(context, "hidden");
    expect(catalogEvents).toEqual([]);
    await deps.extensionSettingsService.set(context, "hidden", true);
    expect(catalogEvents).toEqual([{ id: expect.any(String), eventId: viewDataEvents.extensionCatalogChanged.id }]);
    expect((await metadata(a.id)).projectSetups).toEqual([]);
    expect((await metadata(b.id)).projectSetups).toEqual([]);
    await deps.extensionSettingsService.set(context, "hidden", false);
    await deps.extensionSettingsService.delete(context, "hidden");
    expect(catalogEvents).toHaveLength(3);
    expect((await metadata(a.id)).projectSetups).toHaveLength(1);
    expect((await metadata(b.id)).projectSetups).toHaveLength(1);
    await deps.extensionSettingsService.set(context, "projectValue", 1);
    await deps.extensionSettingsService.delete(context, "projectValue");
    expect(catalogEvents.slice(3)).toEqual([
      { id: expect.any(String), eventId: viewDataEvents.extensionCatalogChanged.id, projectId: a.id },
      { id: expect.any(String), eventId: viewDataEvents.extensionCatalogChanged.id, projectId: a.id },
    ]);
    await deps.extensionSettingsService.set(context, "globalValue", 1);
    await deps.extensionSettingsService.delete(context, "globalValue");
    expect(catalogEvents.slice(5)).toEqual([
      { id: expect.any(String), eventId: viewDataEvents.extensionCatalogChanged.id },
      { id: expect.any(String), eventId: viewDataEvents.extensionCatalogChanged.id },
    ]);
    await deps.extensionService.setProjectExtensionEnabled(first.instance.id, false);
    expect((await metadata(a.id)).projectSetups).toEqual([]);
    expect((await metadata(b.id)).projectSetups).toHaveLength(1);
    expect(snapshot.runtime.extensions[0]?.id).toBe("pstdio.setup");
    await createProjectExtensionLifecycle(deps).uninstall({
      projectId: b.id,
      instanceId: (await deps.extensionService.listProjectExtensionInstances(b.id))[0]!.instance.id,
      deleteUserData: true,
    });
    expect((await metadata(b.id)).projectSetups).toEqual([]);
  } finally {
    stopCatalog();
    await handle.close();
    if (previous === undefined) delete process.env.PSTDIO_DEFAULT_EXTENSIONS;
    else process.env.PSTDIO_DEFAULT_EXTENSIONS = previous;
    await rm(root, { recursive: true, force: true });
  }
});
