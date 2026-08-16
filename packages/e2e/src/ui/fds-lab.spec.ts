import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const fdsLabRepo = process.env.E2E_FDS_LAB_REPO;

test.skip(!fdsLabRepo, "Set E2E_FDS_LAB_REPO to run the repo-local FDS Lab acceptance test.");

const sourceLabels = [
  "Fashion Description System",
  "FDS-E1 · User guidance",
  "FDS-E1 · Occasion vocabulary",
  "FDS-E2 · Style categorization",
  "FDS-E2 · Style vocabulary",
  "FDS-CC1 · Google Merchant Center",
  "FDS-RC1 · Regional compliance",
  "FDS-L10N · English (United States)",
  "FDS-L10N · Swedish (Sweden)",
] as const;

const sourceIds = [
  "fds-core",
  "fds-e1-guidance",
  "fds-e1-occasion-vocabulary",
  "fds-e2-style-categorization",
  "fds-e2-style-vocabulary",
  "fds-cc1-google-merchant",
  "fds-rc1-regional-compliance",
  "fds-l10n-en-us",
  "fds-l10n-sv-se",
] as const;

test("FDS Lab keeps its native tabs, curated configuration, editable source tree, and report resources", async ({
  page,
  request,
}, testInfo) => {
  test.slow();
  const projectResponse = await request.post(`${apiBase}/v1/projects`, { data: { name: "FDS Lab E2E" } });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  const repoResponse = await request.post(`${apiBase}/v1/projects/${project.id}/repos`, {
    data: { name: "Kito", path: fdsLabRepo },
  });
  expect(repoResponse.ok()).toBe(true);

  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", projectId);
  }, project.id);
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto(`/projects/${project.id}`);

  const labEntry = page.getByRole("option", { name: "FDS Lab", exact: true });
  await labEntry.click({ timeout: 60_000 });
  await expect(labEntry).toHaveAttribute("aria-selected", "true");
  const historyTab = page.getByRole("tab", { name: "History", exact: true });
  const filesTab = page.getByRole("tab", { name: "FDS Files", exact: true });
  await expect(historyTab).toBeVisible({ timeout: 30_000 });
  await expect(filesTab).toBeVisible();

  await historyTab.click();
  const experimentFrame = page.frameLocator('iframe[title="New experiment"]');
  await expect(experimentFrame.getByRole("heading", { name: "New experiment" })).toBeVisible({ timeout: 30_000 });
  await expect(experimentFrame.getByLabel("Dataset")).not.toHaveValue("");
  await expect(experimentFrame.getByLabel("Split")).not.toHaveValue("");
  await expect(experimentFrame.getByText("Dataset Path", { exact: true })).toHaveCount(0);
  await expect(experimentFrame.locator("details")).not.toHaveAttribute("open", "");

  await filesTab.click();
  const sourceTree = page.locator('[data-workbench-panel-menu="main-left"]');
  for (const [index, label] of sourceLabels.entries()) {
    const source = sourceTree.locator(`[data-tree-list-focus-id="${sourceIds[index]}"]`);
    await expect(source).toBeAttached();
    await expect(source).toContainText(label);
    await source.scrollIntoViewIfNeeded();
    if ((await source.getAttribute("aria-expanded")) !== "true") {
      await source.getByRole("button", { name: "Expand" }).click();
    }
    const documentTitle = source.locator("xpath=following::button[@role='option'][1]");
    await expect(documentTitle).toHaveAttribute("aria-level", "2");
    const loadResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/extensions/commands/fds-lab.sources.load/execute") &&
        response.request().method() === "POST",
    );
    await documentTitle.click();
    expect((await loadResponse).ok()).toBe(true);
    await expect(page.locator('[contenteditable="true"]').first()).toBeVisible({ timeout: 30_000 });
    await expect(documentTitle).toHaveAttribute("aria-selected", "true");
    await expect(sourceTree.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
    await expect(labEntry).toHaveAttribute("aria-selected", "true");
    await expect(filesTab).toBeVisible();
  }

  const coreSource = sourceTree.locator('[data-tree-list-focus-id="fds-core"]');
  const coreTitle = coreSource.locator("xpath=following::button[@role='option'][1]");
  const coreLoadResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/extensions/commands/fds-lab.sources.load/execute") &&
      response.request().method() === "POST",
  );
  await coreTitle.click();
  expect((await coreLoadResponse).ok()).toBe(true);
  const executiveSummary = sourceTree.locator('[data-tree-list-focus-id="fds-core::1-executive-summary-1"]');
  const sectionLoadResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith("/extensions/commands/fds-lab.sources.load/execute") &&
      response.request().method() === "POST",
  );
  await executiveSummary.click();
  expect((await sectionLoadResponse).ok()).toBe(true);
  await expect(executiveSummary).toHaveAttribute("aria-selected", "true");
  await expect(sourceTree.locator('[role="option"][aria-selected="true"]')).toHaveCount(1);
  const renderedHeading = page.locator('[contenteditable="true"] h2').filter({ hasText: "1. Executive summary" });
  await expect(renderedHeading).toBeVisible();
  await expect
    .poll(async () => {
      const headingBox = await renderedHeading.boundingBox();
      const editorBox = await page.locator('[contenteditable="true"]').first().boundingBox();
      return Boolean(
        headingBox &&
          editorBox &&
          headingBox.top >= editorBox.top &&
          headingBox.top < editorBox.top + Math.min(editorBox.height, 240),
      );
    })
    .toBe(true);

  await historyTab.click();
  const fixtureRow = page.locator("table.data-table tbody tr").filter({ hasText: "playwright-fixture" });
  await expect(fixtureRow).toBeVisible({ timeout: 30_000 });
  await fixtureRow.click();
  const reportTab = page.getByRole("tab").filter({ hasText: "playwright-fixture" });
  await expect(reportTab).toBeVisible({ timeout: 30_000 });
  await expect(historyTab).toBeVisible();
  await expect(filesTab).toBeVisible();
  await expect(labEntry).toHaveAttribute("aria-selected", "true");
  const reportFrame = page.frameLocator('iframe[title="Analysis report"]');
  await expect(reportFrame.getByRole("heading", { name: /playwright-fixture/i })).toBeVisible({ timeout: 30_000 });
  await expect(reportFrame.getByText(/completed/i).first()).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath("fds-lab-report.png"), fullPage: true });
});
