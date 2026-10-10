import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { test } from "./helpers/notification-settings";
import { installShortcutReferenceExtension } from "./helpers/shortcut-reference-extension";
import { showSidenavEntry } from "./helpers/sidenav-navigation";

test.use({ notificationsEnabled: true });

test("lists every registered keyboard shortcut", async ({ page, request }, testInfo) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-299 Keyboard Shortcuts" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  const { instanceId } = await installShortcutReferenceExtension(request, apiBase, project.id);

  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: "Tickets", exact: true }).first()).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();

  await expect(page.getByText("Keyboard shortcuts", { exact: true }).last()).toBeVisible();
  for (const label of [
    "Toggle Command Palette",
    "Run Command",
    "Change Theme",
    "Navigate Back",
    "Navigate Forward",
    "Toggle Sidenav",
    "Open notifications",
    "Keyboard shortcuts",
    "Shortcut greeting",
    "Open shortcut destination",
    "Shortcut inspector",
    "Shortcut reference page + Shortcut inspector",
    "https://example.com/shortcuts",
  ]) {
    await expect(page.getByText(label, { exact: true }).last()).toBeVisible();
  }
  const dialog = page.getByRole("dialog").last();
  await testInfo.attach("shortcut-inventory", { body: await dialog.innerText(), contentType: "text/plain" });
  await dialog.getByRole("menuitem", { name: /Open shortcut destination/ }).focus();
  await page.keyboard.press("ArrowDown");
  await testInfo.attach("shortcut-reference", { body: await page.screenshot(), contentType: "image/png" });
  await expect(dialog.getByRole("group", { name: "Shortcut reference", exact: true })).toBeVisible();
  await expect(dialog.getByRole("menuitem", { name: /Open shortcut destination/ })).toContainText(/J/i);
  for (const enabled of [false, true]) {
    const changed = await request.patch(`${apiBase}/v1/projects/${project.id}/extensions/${instanceId}`, {
      data: { enabled },
    });
    expect(changed.ok()).toBe(true);
    const greeting = dialog.getByText("Shortcut greeting", { exact: true });
    if (enabled) await expect(greeting).toHaveCount(1);
    else await expect(greeting).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await page.keyboard.press("Alt+Shift+J");
  await expect(page).toHaveURL(/\/extensions\/e2e.shortcut-reference\/reference/);
  await page.keyboard.press("Alt+Shift+I");
  await expect(page.getByText("Shortcut inspector", { exact: true }).first()).toBeVisible();
  const nextResponse = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Shortcut isolation" }),
  });
  expect(nextResponse.ok()).toBe(true);
  const nextProject = (await nextResponse.json()) as { id: string };
  await page.goto(`/projects/${nextProject.id}/tickets`);
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();
  await expect(page.getByRole("dialog").last().getByText("Shortcut greeting", { exact: true })).toHaveCount(0);
});

test("the theme picker opens on the current theme and Escape keeps it", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Theme Picker Project" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.addInitScript((selectedProjectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
    localStorage.setItem("theme-preference", "pstdio-dark");
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: "Tickets", exact: true }).first()).toBeVisible({ timeout: 30_000 });
  const html = page.locator("html");
  const savedTheme = () => page.evaluate(() => localStorage.getItem("theme-preference"));

  // Keep a parked pointer from selecting a row when the keyboard opens the picker.
  await page.mouse.move(0, 0);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.keyboard.press("Alt+Shift+T");
    const picker = page.getByRole("dialog");
    await expect(picker.getByRole("option", { selected: true })).toHaveText(/pstdio-dark/);
    await expect(html).toHaveAttribute("data-theme", "pstdio-dark");

    // Moving the highlight previews a theme without saving it.
    await page.keyboard.press("ArrowUp");
    await expect(html).not.toHaveAttribute("data-theme", "pstdio-dark");
    expect(await savedTheme()).toBe("pstdio-dark");

    await page.keyboard.press("Escape");
    await expect(html).toHaveAttribute("data-theme", "pstdio-dark");
    await page.keyboard.press("Escape");
    await expect(picker).toHaveCount(0);
    expect(await savedTheme()).toBe("pstdio-dark");
  }
  expect(consoleErrors.filter((error) => error.includes("Maximum update depth"))).toEqual([]);
});

test("main shortcuts navigate and open creation forms", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Shortcut defaults" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: /^Notes/ }).first()).toBeVisible({ timeout: 30_000 });
  for (const [key, label, destination] of [
    ["S", "Sessions", /\/sessions$/],
    ["W", "Workspaces", /\/workspaces$/],
    ["O", "Notes", /\/notes$/],
    ["P", "Tickets", /\/tickets$/],
  ] as const) {
    await page.goto(`/projects/${project.id}/tickets`);
    await showSidenavEntry(page, label);
    const row = page.getByRole("option", { name: new RegExp(`^${label}`) }).first();
    await row.focus();
    await page.keyboard.press(`Alt+Shift+${key}`);
    await expect(page).toHaveURL(destination);
  }
  await page.keyboard.press("ControlOrMeta+Alt+N");
  const noteForm = page.getByRole("dialog").last();
  await expect(noteForm.getByRole("textbox", { name: "Title", exact: true })).toBeVisible();
  await noteForm.getByRole("textbox", { name: "Title", exact: true }).fill("Shortcut note");
  await noteForm.getByRole("button", { name: "Run", exact: true }).click();
  await expect(noteForm).not.toBeVisible();
  await expect(page.getByText("Shortcut note", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Alt+P");
  const ticketForm = page.getByRole("dialog").last();
  await expect(ticketForm.getByText("New ticket", { exact: true })).toBeVisible();
  await ticketForm.getByRole("textbox", { name: "Description", exact: true }).fill("# Shortcut ticket");
  await ticketForm.getByRole("button", { name: "Run", exact: true }).click();
  await expect(ticketForm).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Shortcut ticket", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).focus();
  await page.keyboard.press("ControlOrMeta+Alt+W");
  const workspaceForm = page.getByRole("dialog").last();
  await expect(workspaceForm.getByRole("heading", { name: "Create workspace", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(workspaceForm).not.toBeVisible();
  await page.getByRole("button", { name: "Help", exact: true }).click();
  await page.getByRole("menuitem", { name: /^Keyboard shortcuts/ }).click();
  const reference = page.getByRole("dialog").last();
  await expect(reference.getByRole("group", { name: "Notes", exact: true })).toBeVisible();
  for (const row of await reference.getByRole("menuitem").all()) {
    await expect(row.locator("kbd").first()).toBeVisible();
  }
});
