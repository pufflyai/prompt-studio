import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
let projectId = "";

const writeRepoExtension = (repoPath: string, name: string, displayName: string) => {
  const extensionPath = join(repoPath, ".pstdio", "extensions", name);
  mkdirSync(extensionPath, { recursive: true });
  writeFileSync(
    join(extensionPath, "package.json"),
    `${JSON.stringify(
      {
        name,
        version: "0.0.1",
        displayName,
        publisher: "e2e",
        main: "./extension.ts",
        engines: { pstdio: EXTENSION_API_VERSION },
        pstdio: { scope: "repo" },
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(extensionPath, "extension.ts"), "export default {};\n");
};

const initializeRepo = (repoPath: string) => {
  mkdirSync(repoPath, { recursive: true });
  const result = spawnSync("git", ["init"], { cwd: repoPath, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
    localStorage.setItem(
      `pstdio-project-settings/projects/${selectedProjectId}/values`,
      JSON.stringify({ state: { sessionModalState: "closed" }, version: 0 }),
    );
  }, projectId);
};

test.beforeAll(async ({ request }) => {
  const e2eHome = process.env.E2E_HOME;
  if (!e2eHome) throw new Error("E2E_HOME is required for repo extension tests.");

  const unique = `${Date.now()}-${process.pid}`;
  const repoPath = join(e2eHome, `repo-extension-toggle-${unique}`);
  initializeRepo(repoPath);
  writeRepoExtension(repoPath, `local-example-${unique}`, "Local Example");

  const projectResponse = await request.post(`${apiBase}/v1/projects`, {
    data: { name: `Repo Extension Toggle ${unique}` },
  });
  expect(projectResponse.ok()).toBe(true);
  const project = (await projectResponse.json()) as { id: string };
  projectId = project.id;

  const repoResponse = await request.post(`${apiBase}/v1/projects/${projectId}/repos`, {
    data: { name: `repo-extension-toggle-${unique}`, path: repoPath },
  });
  expect(repoResponse.status()).toBe(201);
});

const openLocalExtensionToggle = async (page: import("@playwright/test").Page) => {
  await bypassOnboarding(page, projectId);
  await page.goto(`/projects/${projectId}`);
  await page.getByText("Settings", { exact: true }).last().click();
  const settings = page.getByRole("dialog").last();
  await settings.getByText("Extensions", { exact: true }).first().click();

  const localRow = page.getByTestId("extension-entry").filter({ hasText: "Local Example" });
  await expect(localRow).toBeVisible();
  return localRow.locator("input[type='checkbox']");
};

test.describe
  .serial("repo-local extension toggle", () => {
    test("disables the extension", async ({ page }) => {
      const toggle = await openLocalExtensionToggle(page);
      await expect(toggle).toBeChecked();

      const disableResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${projectId}/extensions/`) && response.request().method() === "PATCH",
      );
      await toggle.click({ force: true });
      expect((await disableResponse).status()).toBe(200);
      await expect(toggle).not.toBeChecked();
    });

    test("enables the extension again", async ({ page }) => {
      const toggle = await openLocalExtensionToggle(page);
      await expect(toggle).not.toBeChecked();

      const enableResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${projectId}/extensions/`) && response.request().method() === "PATCH",
      );
      await toggle.click({ force: true });
      expect((await enableResponse).status()).toBe(200);
      await expect(toggle).toBeChecked();
    });
  });
