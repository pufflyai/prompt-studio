import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;
let projectId = "";
let repoPath = "";
let localExtensionName = "";

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
  repoPath = join(e2eHome, `repo-extension-toggle-${unique}`);
  localExtensionName = `local-example-${unique}`;
  initializeRepo(repoPath);
  writeRepoExtension(repoPath, localExtensionName, "Local Example");

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
  return { localRow, settings, toggle: localRow.locator("input[type='checkbox']") };
};

const holdProjectExtensionReads = async (page: import("@playwright/test").Page) => {
  const pattern = `**/v1/projects/${projectId}/extensions**`;
  const held: import("@playwright/test").Route[] = [];
  await page.route(pattern, async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (
      request.method() === "GET" &&
      (pathname === `/v1/projects/${projectId}/extensions` ||
        pathname.endsWith("/extensions/ui") ||
        pathname.endsWith("/contributions"))
    ) {
      held.push(route);
      return;
    }
    await route.continue();
  });

  return {
    wait: () =>
      expect
        .poll(() => held.length, { message: "background extension reconciliation was not requested" })
        .toBeGreaterThan(0),
    release: async () => {
      await page.unroute(pattern);
      await Promise.all(held.splice(0).map((route) => route.continue().catch(() => undefined)));
    },
  };
};

const expectSettingsViewToLoad = async (
  page: import("@playwright/test").Page,
  settings: import("@playwright/test").Locator,
  label: string,
  content: string,
) => {
  await settings.getByText(label, { exact: true }).click();
  const iframe = page.locator(`iframe[title="${label}"]`);
  await expect(iframe).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.frameLocator(`iframe[title="${label}"]`).getByText(content, { exact: true })).toBeVisible();
};

const expectExtensionSettingsViewsToLoad = async (
  page: import("@playwright/test").Page,
  settings: import("@playwright/test").Locator,
) => {
  await expectSettingsViewToLoad(page, settings, "Lab (global)", "Greeting tone");
  await expectSettingsViewToLoad(page, settings, "Lab (project)", "Counter step");
  await expectSettingsViewToLoad(
    page,
    settings,
    "Ticket tags",
    "Configure the tag definitions and options available on tickets.",
  );
};

test.describe
  .serial("repo-local extension toggle", () => {
    test("disables the extension", async ({ page }) => {
      const { settings, toggle } = await openLocalExtensionToggle(page);
      await expect(toggle).toBeChecked();

      const heldReads = await holdProjectExtensionReads(page);
      const disableResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${projectId}/extensions/`) && response.request().method() === "PATCH",
      );
      await toggle.click({ force: true });
      expect((await disableResponse).status()).toBe(200);
      await expect(toggle).not.toBeChecked();
      expect(existsSync(join(repoPath, ".pstdio", "extensions", localExtensionName))).toBe(true);
      await heldReads.wait();
      await heldReads.release();
      await expectExtensionSettingsViewsToLoad(page, settings);

      const listResponse = await page.request.get(`${apiBase}/v1/projects/${projectId}/extensions`);
      const list = (await listResponse.json()) as {
        extensions: Array<{ enabled: boolean; installName: string }>;
      };
      expect(list.extensions.find((extension) => extension.installName === localExtensionName)?.enabled).toBe(false);
    });

    test("enables the extension again", async ({ page }) => {
      const { settings, toggle } = await openLocalExtensionToggle(page);
      await expect(toggle).not.toBeChecked();

      const heldReads = await holdProjectExtensionReads(page);
      const enableResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${projectId}/extensions/`) && response.request().method() === "PATCH",
      );
      await toggle.click({ force: true });
      expect((await enableResponse).status()).toBe(200);
      await expect(toggle).toBeChecked();
      await heldReads.wait();
      await heldReads.release();
      await expectExtensionSettingsViewsToLoad(page, settings);
    });

    test("uninstalls the extension and removes its repo folder", async ({ page }) => {
      const { localRow } = await openLocalExtensionToggle(page);
      await localRow.click();
      await expect(page.getByTestId("extension-detail")).toBeVisible();
      await page.getByRole("tab", { name: "Settings" }).click();

      const heldReads = await holdProjectExtensionReads(page);
      await page.getByTestId("extension-delete").click();
      const dialog = page.getByRole("dialog").last();
      const deleteResponse = page.waitForResponse(
        (response) =>
          response.url().includes(`/v1/projects/${projectId}/extensions/`) && response.request().method() === "DELETE",
      );
      await dialog.getByRole("button", { name: "Delete", exact: true }).click();
      expect((await deleteResponse).status()).toBe(204);

      await expect(page.getByTestId("extensions-panel")).toBeVisible();
      await expect(page.getByTestId("extension-entry").filter({ hasText: "Local Example" })).toHaveCount(0);
      expect(existsSync(join(repoPath, ".pstdio", "extensions", localExtensionName))).toBe(false);
      await heldReads.wait();
      await heldReads.release();
    });
  });
