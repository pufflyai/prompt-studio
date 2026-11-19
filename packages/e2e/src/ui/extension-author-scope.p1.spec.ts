import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin } from "../ui-server";

// Critical risk: regrouping and actual page navigation must preserve keyboard access and selected filters.
test("retains extension filters and keyboard focus through details and enabled regrouping", async ({
  page,
  request,
}) => {
  const folder = join(process.env.E2E_HOME!, `extension-author-scope-${Date.now()}`);
  const source = join(folder, ".pstdio/extensions/personal-tool");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "personal-tool",
      displayName: "Personal tool",
      publisher: "e2e",
      version: "0.0.1",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(source, "extension.ts"), "export default {};\n");
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Extension authors" }, folder),
  });
  expect(created.ok()).toBe(true);
  const project = (await created.json()) as { id: string };
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}`);
  await page.getByRole("option", { name: "Extensions", exact: true }).click();
  const panel = page.getByTestId("extensions-panel");
  await panel.getByRole("button", { name: "Author: All authors", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Me ·/ }).click();
  await panel.getByRole("button", { name: "Scope: All scopes", exact: true }).click();
  await page.getByRole("menuitem", { name: /^This Project ·/ }).click();
  await panel.getByTestId("extensions-search").fill("Personal");
  const row = panel.getByTestId("extension-entry");
  await expect(row).toHaveCount(1);
  await expect(row.locator('[data-extension-author="me"]')).toContainText("Me");
  await expect(row.locator('[data-extension-scope="repo"]')).toContainText("This Project");
  await row.focus();
  await page.keyboard.press("Enter");
  const back = page.getByTestId("extension-detail").getByRole("button", { name: "Extensions", exact: true });
  await expect(back).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel.getByTestId("extensions-search")).toHaveValue("Personal");
  await expect(panel.getByRole("button", { name: "Author: Me", exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Scope: This Project", exact: true })).toBeVisible();
  await expect(row).toBeFocused();
  const toggle = row.getByRole("checkbox");
  await toggle.focus();
  await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await expect(panel.getByTestId("extensions-group-installed")).toBeVisible();
  await expect(panel.getByTestId("extensions-group-enabled")).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(toggle).toBeChecked();
  await expect(panel.getByTestId("extensions-group-enabled")).toBeVisible();
  await expect(toggle).toBeFocused();
});
