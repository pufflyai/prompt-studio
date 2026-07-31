import { execSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
const extensionSource = join(import.meta.dirname, "../../../../.pstdio/extensions/data-table-demo");
const extensionFiles = ["extension.ts", "package.json", "tsconfig.json"] as const;

const createDemoRepo = () => {
  const repoRoot = mkdtempSync(join(tmpdir(), "pstdio-e2e-data-table-"));
  const extensionRoot = join(repoRoot, ".pstdio/extensions/data-table-demo");
  mkdirSync(extensionRoot, { recursive: true });
  for (const file of extensionFiles) copyFileSync(join(extensionSource, file), join(extensionRoot, file));
  writeFileSync(join(repoRoot, "README.md"), "# DataTable extension e2e\n");
  execSync("git init -b main", { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: repoRoot, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: repoRoot, stdio: "pipe" });
  execSync("git add .", { cwd: repoRoot, stdio: "pipe" });
  execSync("git commit -m init", { cwd: repoRoot, stdio: "pipe" });
  return repoRoot;
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "DataTable Extension" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const registerRepo = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  repoRoot: string,
) => {
  const response = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name: "data-table-extension", path: repoRoot },
  });
  expect(response.ok()).toBe(true);
};

const waitForDataTableExtension = async (request: import("@playwright/test").APIRequestContext, projectId: string) => {
  await expect
    .poll(async () => {
      const response = await request.get(`${apiBase}/v1/projects/${projectId}/extensions/ui`);
      if (!response.ok()) return false;
      const metadata = (await response.json()) as { dataTableRenderers?: Array<{ id: string }> };
      return metadata.dataTableRenderers?.some((renderer) => renderer.id === "data-table-demo.services") ?? false;
    })
    .toBe(true);
};

const prepareDashboard = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
  await page.setViewportSize({ width: 1440, height: 900 });
};

test("repo-local DataTable selection actions execute with the original row ids", async ({ page, request }) => {
  const repoRoot = createDemoRepo();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));

  try {
    const project = await createProject(request);
    await registerRepo(request, project.id, repoRoot);
    await waitForDataTableExtension(request, project.id);
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}`);

    const sidenav = page.locator('[data-workbench-region="sidenav"]');
    await sidenav.getByRole("option", { name: "DataTable Demo", exact: true }).click();
    await expect(page.getByText("Gateway", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Worker", { exact: true }).first()).toBeVisible();

    const rowSelectors = page.getByLabel("Select row");
    await expect(rowSelectors).toHaveCount(2);
    await rowSelectors.nth(0).click();
    await rowSelectors.nth(1).click();

    const toolbar = page.getByRole("toolbar", { name: "Selection actions" });
    await expect(toolbar).toContainText("2 rows selected");
    await expect(toolbar.locator("..")).toHaveCSS("position", "absolute");

    const [response] = await Promise.all([
      page.waitForResponse((candidate) =>
        new URL(candidate.url()).pathname.endsWith("/extensions/commands/data-table-demo.services.restart/execute"),
      ),
      toolbar.getByRole("button", { name: "Restart selected" }).click(),
    ]);
    expect(response.ok()).toBe(true);
    await expect(page.getByText("Services restarted", { exact: true })).toBeVisible();
    await expect(page.getByText("Restarted 2 services: gateway, worker", { exact: true })).toBeVisible();

    const body = (await response.json()) as {
      outcome: { value: { restartedRowIds: string[] } };
    };
    expect(body.outcome.value.restartedRowIds).toEqual(["gateway", "worker"]);
    expect(consoleErrors).toEqual([]);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
});
