import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    // Pre-select the project so the shell never opens the project picker when
    // parallel tests have created several projects.
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

const createInstalledExtension = (input: { displayName: string; installName: string }) => {
  const home = process.env.E2E_HOME;
  if (!home) throw new Error("E2E_HOME is required for extension delete tests.");

  const sourcePath = join(home, "extensions", input.installName);
  rmSync(sourcePath, { recursive: true, force: true });
  mkdirSync(sourcePath, { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    `${JSON.stringify(
      {
        name: input.installName,
        version: "0.0.1",
        displayName: input.displayName,
        publisher: "e2e",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(sourcePath, "extension.ts"), "export default {};\n");
  return sourcePath;
};

// Regression: interacting with the delete confirmation (e.g. the delete-data
// checkbox) must not dismiss the modal or the settings overlay behind it.
test("delete extension flow survives clicks inside the confirmation modal", async ({ page, request }) => {
  const unique = Date.now();
  const installName = `e2e-delete-flow-${unique}`;
  const displayName = `E2E Delete Flow ${unique}`;
  const projectRes = await request.post(`${apiBase}/v1/projects`, { data: { name: `Delete Flow ${unique}` } });
  expect(projectRes.ok()).toBe(true);
  const project = (await projectRes.json()) as { id: string };
  const sourcePath = createInstalledExtension({ displayName, installName });

  const listed = await request.get(`${apiBase}/v1/projects/${project.id}/extensions`);
  expect(listed.ok()).toBe(true);

  await bypassOnboarding(page, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByText("Settings", { exact: true }).last().click();
  const overlay = page.getByRole("dialog").last();
  await overlay.getByText("Extensions", { exact: true }).first().click();

  const row = page.getByTestId("extension-entry").filter({ hasText: displayName });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByTestId("extension-detail")).toBeVisible();
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByTestId("extension-delete").click();

  const dialog = page.getByRole("dialog").last();
  await expect(dialog.getByText("Delete extension?")).toBeVisible();

  // Clicking controls inside the modal keeps it (and the settings overlay) open.
  await dialog.getByText("Also delete this extension's data", { exact: false }).click();
  await expect(page.getByRole("dialog").last().locator("input[type='checkbox']")).toBeChecked();
  await expect(page.getByText("Delete extension?")).toBeVisible();

  const deleteResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/v1/projects/${project.id}/extensions/`) && response.request().method() === "DELETE",
  );
  await page.getByRole("dialog").last().getByRole("button", { name: "Delete", exact: true }).click();
  expect((await deleteResponse).status()).toBe(204);

  await expect(row).toHaveCount(0);
  await expect.poll(() => existsSync(sourcePath)).toBe(false);
});
