import { expect, test } from "bun:test";
import { automationDefinitionId, automationsId, publishedExtensionsId } from "pstdio-sync-contracts";
import { createTestApp } from "../../../test-utils/create-test-app";
import { openPublishedCatalog } from "../publication/catalog";
import { changePublishedCatalog } from "../publication/change-catalog";
import { listAutomations, openAutomationCatalog } from "./catalog";
import { createCatalogRelayFixture } from "./relay.fixture";
import { acknowledgeAutomations, loadAutomationState } from "./state";

test("an offline publication disable reports pending delivery instead of reusing its old application acknowledgment", async () => {
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Shared" });
    const { environmentId } = await app.deps.environmentService.get();
    const publications = await openPublishedCatalog(app.deps, project.id);
    const bytes = new Blob(["package"]);
    const asset = await app.deps.assetTransferService.stage(
      { workbenchId: project.id, extensionId: publishedExtensionsId },
      "package",
      bytes,
    );
    const source = await publications.records.read("clock");
    await publications.records.commit({
      operationId: "publish",
      edits: [
        {
          recordId: "clock",
          expectedRevision: source.revision,
          replace: { extensionId: "clock", revision: asset.sha256, automation: true, enabled: true },
          asset,
        },
      ],
    });
    await publications.synchronize(createCatalogRelayFixture(project.id, undefined, publishedExtensionsId));
    const catalog = await openAutomationCatalog(app.deps, project.id);
    const recordId = automationDefinitionId("clock.schedule.tick");
    await catalog.records.commit({
      operationId: "assign",
      edits: [
        {
          recordId,
          expectedRevision: (await catalog.records.read(recordId)).revision,
          replace: {
            kind: "definition",
            scheduleId: "clock.schedule.tick",
            extensionId: "clock",
            enabled: true,
            startsAt: "2026-10-19T09:00:00.000Z",
            target: { environmentId, workbenchId: project.id, workspaceId: "local" },
          },
        },
      ],
    });
    const relay = createCatalogRelayFixture(project.id);
    await catalog.synchronize(relay);
    await acknowledgeAutomations(app.deps, await loadAutomationState(app.deps, project.id));
    await catalog.synchronize(relay);
    expect((await listAutomations(app.deps, project.id))[0]!.delivery).toBe("applied");
    await changePublishedCatalog(app.deps, project.id, {
      kind: "enabled",
      extensionId: "clock",
      expectedRevision: (await publications.records.read("clock")).revision,
      enabled: false,
    });
    expect((await listAutomations(app.deps, project.id))[0]!.delivery).toBe("pending");
    expect((await loadAutomationState(app.deps, project.id)).disabledExtensions.has("clock")).toBe(true);
    for (const extensionId of [automationsId, "pstdio.automation-runs"]) {
      await expect(
        app.deps.extensionService.registerInstalledSource({
          extensionId,
          sourcePath: "/reserved",
          installName: "reserved",
          name: "reserved",
          displayName: "Reserved",
          manifest: {},
        }),
      ).rejects.toThrow("Reserved");
    }
  } finally {
    await app.close();
  }
});
