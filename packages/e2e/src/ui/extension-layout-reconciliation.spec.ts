import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const regions = [
  "nav",
  "activity",
  "sidenav-header",
  "sidenav",
  "main-header",
  "main-left-menu",
  "main",
  "main-right-menu",
  "secondary-header",
  "secondary-left-menu",
  "secondary",
  "secondary-right-menu",
  "side-header",
  "side-left-menu",
  "side",
  "side-right-menu",
  "status",
  "overlay",
] as const;

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: { name: "Extension Layout Reconciliation" },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const fetchExtensionMetadata = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  expect(response.ok()).toBe(true);
  return (await response.json()) as WorkbenchExtensionMetadata;
};

const layoutWidgetIds = (persisted: { layout: { regions: Record<string, { widgets: { widgetId: string }[] }> } }) =>
  Object.values(persisted.layout.regions).flatMap((region) => region.widgets.map((placement) => placement.widgetId));

const refId = (ref: { extensionId: string; kind: string; id: string }) =>
  ref.extensionId === "pstdio" ? ref.id : `${ref.extensionId}.${ref.kind}.${ref.id}`;

// The layout store discards layouts written by an older schema version, so this
// covers the live rule instead: a current-version layout is reconciled against the
// panels an extension still contributes, and the per-extension reset command clears it.
test("reconciles and locally resets extension layouts across reloads", async ({ page, request }) => {
  const project = await createProject(request);
  const metadata = await fetchExtensionMetadata(request, project.id);
  const nativeView = metadata.views.find(
    (view) =>
      view.body.kind !== "webview" &&
      metadata.placements.some((placement) => placement.item.kind === "view" && refId(placement.item.view) === view.id),
  );
  expect(nativeView).toBeDefined();
  const nativePlacement = metadata.placements.find(
    (placement) => placement.item.kind === "view" && refId(placement.item.view) === nativeView!.id,
  );
  expect(nativePlacement).toBeDefined();
  const nativeViewRegion = nativePlacement!.region;
  const extension = metadata.extensions.find((candidate) => candidate.id === nativeView!.extensionId);
  expect(extension).toBeDefined();

  const legacyWidgetId = `dashboard-workbench.extension-view.${nativeView!.id}`;
  const removedPanelId = `${nativeView!.id}.removed`;
  const removedWidgetId = `dashboard-workbench.extension-view.${removedPanelId}`;
  const scope = `project/${project.id}/mode/legacy/aggregate/empty`;
  const layoutKey = `dashboard-wb:layout:${scope}`;
  const compatibilityKey = `dashboard-wb:layout-compatibility:dashboard.extensions:${project.id}`;
  const previousCompatibility = JSON.stringify([
    {
      bodyKind: "webview",
      extensionId: nativeView!.extensionId,
      modeIds: [],
      panelId: nativeView!.id,
      region: nativeViewRegion,
      widgetId: legacyWidgetId,
    },
    {
      bodyKind: "webview",
      extensionId: nativeView!.extensionId,
      modeIds: [],
      panelId: removedPanelId,
      region: "main",
      widgetId: removedWidgetId,
    },
  ]);
  const layout = {
    regions: Object.fromEntries(regions.map((id) => [id, { id, visible: true, widgets: [] }])) as Record<
      string,
      { id: string; visible: boolean; widgets: Record<string, unknown>[]; activeWidgetId?: string }
    >,
    activeWidgetId: legacyWidgetId,
    activeLocationWidgetId: legacyWidgetId,
    activeResourceUri: "resource://legacy",
    locationSubPanelSelections: { "resource://legacy": { main: legacyWidgetId } },
  };
  layout.regions.main!.widgets = [
    {
      widgetId: legacyWidgetId,
      contributionId: legacyWidgetId,
      pinned: true,
      resource: {
        kind: "extension-view",
        id: nativeView!.id,
        uri: "resource://legacy",
        label: nativeView!.title,
        metadata: { extensionId: nativeView!.extensionId },
      },
      resourceUri: "resource://legacy",
      tabRetention: "persistent",
    },
    { widgetId: nativeView!.id, contributionId: nativeView!.id },
    {
      widgetId: removedWidgetId,
      contributionId: removedWidgetId,
      resource: { metadata: { extensionId: nativeView!.extensionId } },
    },
    { widgetId: "dashboard.unrelated", contributionId: "dashboard.unrelated" },
  ];
  layout.regions.main!.activeWidgetId = legacyWidgetId;

  await page.addInitScript(
    ({ currentLayoutKey, currentProjectId, currentCompatibilityKey, currentLayout, oldCompatibility }) => {
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.extension-lab.harness.fake");
      localStorage.setItem("dashboard-wb:selected-project:global", currentProjectId);
      const seedKey = `ps-221-layout-seeded:${currentProjectId}`;
      if (localStorage.getItem(seedKey)) return;
      localStorage.setItem(currentLayoutKey, JSON.stringify({ version: 3, layout: currentLayout }));
      localStorage.setItem(currentCompatibilityKey, JSON.stringify(oldCompatibility));
      localStorage.setItem(seedKey, "true");
    },
    {
      currentCompatibilityKey: compatibilityKey,
      currentLayout: layout,
      currentLayoutKey: layoutKey,
      currentProjectId: project.id,
      oldCompatibility: previousCompatibility,
    },
  );
  await page.goto(`/projects/${project.id}`);

  await expect
    .poll(() => page.evaluate((key) => localStorage.getItem(key), compatibilityKey))
    .not.toBe(JSON.stringify(previousCompatibility));
  const migrated = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), layoutKey);
  expect(layoutWidgetIds(migrated).sort()).toEqual(["dashboard.unrelated", nativeView!.id].sort());
  const migratedPlacement = migrated.layout.regions[nativeViewRegion].widgets.find(
    (placement: { widgetId: string }) => placement.widgetId === nativeView!.id,
  );
  expect(migratedPlacement).toMatchObject({
    pinned: true,
    viewId: nativeView!.id,
    tabRetention: "persistent",
  });
  expect(migratedPlacement.resource).toBeUndefined();
  expect(migratedPlacement.resourceUri).toBeUndefined();
  expect(migrated.layout.activeWidgetId).toBe(nativeView!.id);
  expect(migrated.layout.activeLocationWidgetId).toBe(nativeView!.id);
  expect(migrated.layout.locationSubPanelSelections[`${nativeView!.id}:${nativeView!.id}`]).toEqual({
    [nativeViewRegion]: nativeView!.id,
  });

  const extensionName = extension!.displayName || extension!.name || extension!.id;
  const resetLabel = `Reset ${extensionName} layout`;
  await page.keyboard.press("ControlOrMeta+KeyK");
  const paletteInput = page.getByRole("dialog").getByRole("textbox");
  await expect(paletteInput).toBeVisible();
  await paletteInput.fill("> reset");
  await expect(page.getByText(resetLabel, { exact: true })).toBeVisible();
  await page.getByText(resetLabel, { exact: true }).click();

  const reset = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), layoutKey);
  expect(layoutWidgetIds(reset)).toEqual(["dashboard.unrelated"]);

  await page.reload();
  const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), layoutKey);
  expect(layoutWidgetIds(restored)).toEqual(["dashboard.unrelated"]);
});
