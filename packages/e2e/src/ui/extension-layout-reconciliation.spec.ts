import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import type { WorkbenchExtensionMetadata } from "pstdio-api-contracts";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");
const installName = "extension-lab-layout-reconciliation";
const modeId = "pstdio.extension-lab.lab";
const panelId = "extension-lab.labOverview";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "Extension Layout Reconciliation" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const disableDefaultExtensionLab = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions`);
  const body = (await response.json()) as { extensions: Array<{ id: string; installName: string }> };
  for (const extension of body.extensions.filter((entry) => entry.installName === "extension-lab")) {
    await request.patch(`${apiBase}/v1/projects/${projectId}/extensions/${extension.id}`, {
      data: { enabled: false },
    });
  }
};

const enableExtension = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  sourcePath: string,
) => {
  const response = await request.post(
    `${apiBase}/v1/projects/${projectId}/extensions/installed/${installName}/enable`,
    {
      data: {
        displayName: "Extension Lab",
        extensionId: "pstdio.extension-lab",
        manifest: { id: "pstdio.extension-lab", name: "extension-lab" },
        name: "extension-lab",
        sourceHash: "layout-reconciliation-e2e",
        sourceKind: "local_path",
        sourcePath,
        sourceRef: null,
        version: "0.1.0",
      },
    },
  );
  expect(response.ok()).toBe(true);
  return (await response.json()) as { instanceId: string };
};

const reloadExtension = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  instanceId: string,
) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/extensions/${instanceId}/reload`);
  expect(response.ok()).toBe(true);
  expect(await response.json()).toMatchObject({ status: "loaded" });
};

const panelBodyKind = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  contributionId: string,
) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  const metadata = (await response.json()) as WorkbenchExtensionMetadata;
  const panel = metadata.panels.find((candidate) => candidate.id === contributionId);
  if (!panel) return "missing";
  if (panel.webview) return "webview";
  if (panel.dataTableRendererId) return "data-table";
  return "unknown";
};

const layoutResetRevision = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
  const metadata = (await response.json()) as WorkbenchExtensionMetadata;
  return metadata.extensions.find((extension) => extension.id === "pstdio.extension-lab")?.layoutReset?.revision;
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    if (window !== window.top) return;
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const switchToLabMode = async (page: import("@playwright/test").Page) => {
  const sidenav = page.locator('[data-workbench-region="sidenav"]');
  await sidenav.getByRole("option", { name: "Lab coding mode", exact: true }).click({ timeout: 10_000 });
};

const waitForSyncConnection = (page: import("@playwright/test").Page) =>
  page.waitForResponse((response) => response.url().includes("/v1/sync/stream") && response.status() === 200, {
    timeout: 10_000,
  });

const reloadDashboard = async (page: import("@playwright/test").Page) => {
  const syncConnection = waitForSyncConnection(page);
  await page.reload();
  await syncConnection;
};

const replaceOverviewWithDataTable = (extensionRoot: string) => {
  const contributionsPath = join(extensionRoot, "src/renderers/ui-contributions.ts");
  const contributions = readFileSync(contributionsPath, "utf8");
  const nextContributions = contributions.replace(
    / {4}labOverview: \{[\s\S]*?\n {4}labConsole:/,
    `    labOverview: {
      title: l10n("panels.labOverview.title", "Lab overview"),
      region: "main",
      closable: false,
      dataTableRenderer: "layoutOverview",
    },
    labConsole:`,
  );
  expect(nextContributions).not.toBe(contributions);
  writeFileSync(contributionsPath, nextContributions);

  const extensionPath = join(extensionRoot, "extension.ts");
  const source = readFileSync(extensionPath, "utf8");
  const nextSource = source
    .replace(
      "  commands: labCommands,",
      `  commands: {
    ...labCommands,
    layoutOverviewQuery: {
      title: "Load layout overview",
      run: async () => ({ rows: [] }),
    },
  },`,
    )
    .replace(
      "  commandPaletteResources: {",
      `  dataTableRenderers: {
    layoutOverview: {
      title: "Lab overview",
      queryCommand: commandRef("layoutOverviewQuery"),
      emptyTitle: "No rows",
    },
  },
  commandPaletteResources: {`,
    );
  expect(nextSource).not.toBe(source);
  writeFileSync(extensionPath, nextSource);
};

const removeOverview = (extensionRoot: string) => {
  const contributionsPath = join(extensionRoot, "src/renderers/ui-contributions.ts");
  const source = readFileSync(contributionsPath, "utf8");
  const next = source
    .replace('        { region: "main", panel: "labOverview" },\n', "")
    .replace(/ {4}labOverview: \{[\s\S]*?\n {4}labConsole:/, "    labConsole:");
  expect(next).not.toBe(source);
  writeFileSync(contributionsPath, next);
};

const readResetMarker = async (page: import("@playwright/test").Page, projectId: string) =>
  page.evaluate(
    (selectedProjectId) => localStorage.getItem(`dashboard-wb:layout-reset:${selectedProjectId}/pstdio.extension-lab`),
    projectId,
  );

const readPersistedPanelPlacements = async (
  page: import("@playwright/test").Page,
  projectId: string,
  contributionId: string,
) =>
  page.evaluate(
    ({ selectedProjectId, selectedContributionId }) => {
      const prefix = `dashboard-wb:layout:project/${selectedProjectId}/mode/pstdio.extension-lab.lab/`;
      const currentContributionId = selectedContributionId;
      const legacyContributionId = `dashboard-workbench.extension-view.${selectedContributionId}`;
      const scopes = Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => {
          const raw = localStorage.getItem(key);
          if (!raw) return { current: 0, key, legacy: 0, logical: 0 };
          const persisted = JSON.parse(raw) as {
            layout: { regions: Record<string, { widgets: Array<{ contributionId: string }> }> };
          };
          const placements = Object.values(persisted.layout.regions).flatMap((region) => region.widgets);
          const current = placements.filter((placement) => placement.contributionId === currentContributionId).length;
          const legacy = placements.filter((placement) => placement.contributionId === legacyContributionId).length;
          return { current, key, legacy, logical: current + legacy };
        });
      return {
        current: scopes.reduce((total, scope) => total + scope.current, 0),
        legacy: scopes.reduce((total, scope) => total + scope.legacy, 0),
        maxLogicalPerScope: Math.max(0, ...scopes.map((scope) => scope.logical)),
        scopes,
      };
    },
    { selectedProjectId: projectId, selectedContributionId: contributionId },
  );

test.describe("Extension layout reconciliation", () => {
  test.beforeEach(async ({ request }) => deleteAllProjects(request));

  test("reconciles body changes and removals, and fences a host reset from stale pagehide writes", async ({
    page,
    request,
  }) => {
    const extensionRoot = mkdtempSync(join(tmpdir(), "pstdio-extension-layout-reconciliation-"));
    cpSync(extensionLabPath, extensionRoot, { recursive: true });

    try {
      const project = await createProject(request);
      await disableDefaultExtensionLab(request, project.id);
      const enabled = await enableExtension(request, project.id, extensionRoot);
      await prepareDashboard(page, project.id);
      const initialSyncConnection = waitForSyncConnection(page);
      await page.goto(`/projects/${project.id}`);
      await initialSyncConnection;
      await switchToLabMode(page);

      const overviewFrame = page.locator('iframe[title="Lab overview"]');
      await expect(overviewFrame).toHaveCount(1);
      await expect(page.frameLocator('iframe[title="Lab overview"]').getByText("Sandbox webview")).toBeVisible();
      await expect
        .poll(() => readPersistedPanelPlacements(page, project.id, panelId))
        .toMatchObject({
          current: 0,
          legacy: 1,
          maxLogicalPerScope: 1,
        });

      replaceOverviewWithDataTable(extensionRoot);
      await reloadExtension(request, project.id, enabled.instanceId);
      await expect.poll(() => panelBodyKind(request, project.id, panelId)).toBe("data-table");
      await reloadDashboard(page);
      await expect(page.getByText("No rows", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(overviewFrame).toHaveCount(0);
      await expect
        .poll(() => readPersistedPanelPlacements(page, project.id, panelId))
        .toMatchObject({
          legacy: 0,
          maxLogicalPerScope: 1,
        });

      const reset = await request.post(
        `${apiBase}/v1/projects/${project.id}/extensions/${enabled.instanceId}/reset-layout`,
        { data: { modeId } },
      );
      expect(reset.ok()).toBe(true);
      const resetResult = (await reset.json()) as { revision: string };
      await expect.poll(() => layoutResetRevision(request, project.id)).toBe(resetResult.revision);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
      await reloadDashboard(page);
      await expect.poll(() => readResetMarker(page, project.id)).toBe(resetResult.revision);
      await expect(page.getByText("No rows", { exact: true })).toHaveCount(1);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
      await expect
        .poll(() => readPersistedPanelPlacements(page, project.id, panelId))
        .toMatchObject({
          legacy: 0,
          maxLogicalPerScope: 1,
        });

      removeOverview(extensionRoot);
      await reloadExtension(request, project.id, enabled.instanceId);
      await expect.poll(() => panelBodyKind(request, project.id, panelId)).toBe("missing");
      await expect(page.getByText("No rows", { exact: true })).toHaveCount(0, { timeout: 10_000 });
      await expect
        .poll(() => readPersistedPanelPlacements(page, project.id, panelId))
        .toMatchObject({
          current: 0,
          legacy: 0,
          maxLogicalPerScope: 0,
        });
      await reloadDashboard(page);
      await expect
        .poll(() => readPersistedPanelPlacements(page, project.id, panelId))
        .toMatchObject({
          current: 0,
          legacy: 0,
          maxLogicalPerScope: 0,
        });
      const metadataResponse = await request.get(`${apiBase}/v1/projects/${project.id}/extensions/ui`);
      const metadata = (await metadataResponse.json()) as WorkbenchExtensionMetadata;
      expect(metadata.panels.some((panel) => panel.id === panelId)).toBe(false);
    } finally {
      rmSync(extensionRoot, { recursive: true, force: true });
    }
  });
});
