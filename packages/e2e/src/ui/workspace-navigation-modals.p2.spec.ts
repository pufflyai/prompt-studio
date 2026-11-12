import { rmSync } from "node:fs";
import type { ListProjectExtensionsResponse } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
import { expect, test } from "../scripts/session-test";
import { uiOrigin } from "../ui-server";
import { getSidenavEntry } from "./helpers/sidenav-navigation";
import { prepareDashboard } from "./helpers/workspace-files";
import { createGitRepo } from "./helpers/workspace-session-attempt";

// Critical risks: Files must open the project tree; modal cancellation, keyboard focus
// and successful creation must preserve or change Main only when the action requires it.
test("Files opens without Home and workspace creation stays in a keyboard-accessible modal", async ({
  page,
  request,
}) => {
  const capacity = await (await request.get(`${uiOrigin}/v1/workspaces/capacity`)).json();
  const root = createGitRepo("pstdio-workspace-modal-", "Workspace modal example");
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Workspace modal" }, root),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    const inventory = (await (
      await request.get(`${uiOrigin}/v1/projects/${project.id}/extensions`)
    ).json()) as ListProjectExtensionsResponse;
    const home = inventory.extensions.find((extension) => extension.extensionId === "pstdio.home");
    expect(home).toBeDefined();
    expect(
      (
        await request.patch(`${uiOrigin}/v1/projects/${project.id}/extensions/${home!.id}`, {
          data: { enabled: false },
        })
      ).ok(),
    ).toBe(true);
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    const files = await getSidenavEntry(page, "Files");
    await files.click();
    await expect(page.getByRole("textbox", { name: "Search files" })).toBeVisible();
    await expect(files).toHaveAttribute("aria-selected", "true");
    await expect(await getSidenavEntry(page, "Workspaces")).toHaveAttribute("aria-selected", "false");
    await page.getByRole("option", { name: "README.md", exact: true }).click();
    await expect(page.locator(".monaco-editor").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Changes", exact: true })).toHaveCount(0);
    await (await getSidenavEntry(page, "Workspaces")).click();
    await page.getByRole("tab", { name: "Compact", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Compact", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByText(capacity.deviceName, { exact: true }).filter({ visible: true })).toHaveCount(0);
    await page.getByRole("tab", { name: "By device", exact: true }).click();
    const device = page.getByText(capacity.deviceName, { exact: true }).filter({ visible: true });
    const openCreate = async () => {
      await device.click({ button: "right" });
      await page.getByRole("menuitem", { name: "Create workspace", exact: true }).click();
    };
    const location = page.url();
    const form = page.frameLocator('iframe[title="Workspace action"]');
    await openCreate();
    await expect(form.getByRole("button", { name: "Create workspace", exact: true })).toBeEnabled();
    await expect(page.getByRole("dialog")).toBeVisible();
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(location);
    await expect(device.locator("xpath=ancestor::*[@role='option'][1]")).toBeFocused();
    await openCreate();
    await form.getByRole("button", { name: "Cancel", exact: true }).press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(location);
    await expect(device.locator("xpath=ancestor::*[@role='option'][1]")).toBeFocused();
    await page.goto(`/projects/${project.id}/workspaces`);
    await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
    await page.getByRole("menuitem", { name: "Create workspace", exact: true }).click();
    await form.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect(page).toHaveURL(/extensions\/pstdio\.pstdio-workspaces\/workspace\?/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});
