import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { ListProjectExtensionsResponse } from "pstdio-api-contracts";
import { folderProjectInput } from "../helpers/folder-project";
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
    const home = inventory.extensions.find((extension) => extension.extensionId === "pstdio.pstdio-home");
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
    await expect(page.getByText("This device", { exact: true })).toBeHidden();
    await page.getByRole("tab", { name: "By device", exact: true }).click();
    const add = page.getByRole("button", { name: /^Add to / });
    const location = page.url();
    const form = page.frameLocator('iframe[title="Workspace action"]');
    await add.click();
    await expect(form.getByRole("button", { name: "Create workspace", exact: true })).toBeEnabled();
    await expect(page.getByRole("dialog")).toBeVisible();
    await form.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(location);
    await expect(add).toBeFocused();
    await add.click();
    await form.getByRole("button", { name: "Cancel", exact: true }).press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(page.url()).toBe(location);
    await expect(add).toBeFocused();
    await add.click();
    await form.getByRole("button", { name: "Create workspace", exact: true }).click();
    await expect(page).toHaveURL(/extensions\/pstdio\.pstdio-workspaces\/workspace\?/);
    await expect(page.getByRole("dialog")).toHaveCount(0);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
    rmSync(root, { recursive: true, force: true });
  }
});

// Critical risk: an optional limit must remain editable after toggling/resetting and
// actually save the displayed number; unlimited must remain a supported capacity value.
test("device details stages an optional workspace limit and preserves Main", async ({ page, request }) => {
  const capacityUrl = `${uiOrigin}/v1/workspaces/capacity`;
  const previous = await (await request.get(capacityUrl)).json();
  const response = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Workspace limits" }),
  });
  expect(response.ok()).toBe(true);
  const project = await response.json();
  try {
    expect((await request.patch(capacityUrl, { data: { limit: null } })).ok()).toBe(true);
    await prepareDashboard(page, project.id);
    await page.goto(`/projects/${project.id}/workspaces`);
    await page.getByText("This device", { exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Device details", exact: true });
    const limited = dialog.getByRole("checkbox", { name: "Limit workspaces", exact: true });
    const count = dialog.getByRole("spinbutton", { name: "Workspace limit", exact: true });
    const toggle = dialog
      .locator('label[data-scope="switch"]')
      .filter({ has: page.getByRole("checkbox", { name: "Limit workspaces", exact: true }) });
    const location = page.url();
    await expect(limited).not.toBeChecked();
    await expect(count).toBeDisabled();
    await toggle.click();
    await expect(count).toBeEnabled();
    await count.fill("7");
    await toggle.click();
    await expect(count).toBeDisabled();
    await toggle.click();
    await expect(count).toHaveValue("7");
    await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    await expect(limited).not.toBeChecked();
    await toggle.click();
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect.poll(async () => (await (await request.get(capacityUrl)).json()).limit).toBe(6);
    await toggle.click();
    await dialog.getByRole("button", { name: "Apply", exact: true }).click();
    await expect.poll(async () => (await (await request.get(capacityUrl)).json()).limit).toBeNull();
    await expect(count).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    expect(page.url()).toBe(location);
  } finally {
    await request.patch(capacityUrl, { data: { limit: previous.limit } });
    await request.delete(`${uiOrigin}/v1/projects/${project.id}`);
  }
});
