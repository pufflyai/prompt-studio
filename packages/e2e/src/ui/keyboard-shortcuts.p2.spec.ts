import { expect } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { uiOrigin as apiBase } from "../ui-server";
import { test } from "./helpers/notification-settings";
import { installShortcutReferenceExtension } from "./helpers/shortcut-reference-extension";
import { showSidenavEntry } from "./helpers/sidenav-navigation";
import { changeThemeThroughCommandPalette } from "./helpers/theme-picker";

test.use({ notificationsEnabled: true });

test("new-tab creation adds a Secondary tab and Close selects that instance", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Typed session tabs" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript(() => localStorage.setItem("onboarding-complete", "true"));
  await page.goto(`/projects/${project.id}/sessions`);
  await expect(page.getByRole("button", { name: "Help", exact: true })).toBeVisible();
  const secondary = page.locator('[data-workbench-region="secondary"]');
  const before = await secondary.getByRole("tab").count();
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("v");
  await page.keyboard.press("n");
  await page
    .getByRole("dialog", { name: "New tab · destination", exact: true })
    .getByRole("button", { name: /Secondary/ })
    .click();
  await page
    .getByRole("dialog", { name: "New tab · panel type", exact: true })
    .getByRole("button", { name: /Session/ })
    .click();
  await expect(secondary.getByRole("tab")).toHaveCount(before + 1);
  await page.keyboard.press("Alt+Shift+Space");
  await page.keyboard.press("v");
  await page.keyboard.press("x");
  await page
    .getByRole("dialog", { name: "Close tab", exact: true })
    .getByRole("button", { name: /Secondary/ })
    .click();
  await expect(secondary.getByRole("tab")).toHaveCount(before);
});

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
    "Choose color theme",
    "Go back",
    "Go forward",
    "Toggle Sidenav",
    "Go to notifications",
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
  await dialog.getByRole("group", { name: "Open shortcut destination", exact: true }).scrollIntoViewIfNeeded();
  await testInfo.attach("shortcut-reference", { body: await page.screenshot(), contentType: "image/png" });
  await expect(dialog.getByRole("group", { name: "Open shortcut destination", exact: true })).toContainText(
    "Shortcut reference",
  );
  await expect(dialog.getByRole("group", { name: "Open shortcut destination", exact: true })).toContainText(/J/i);
  for (const enabled of [false, true]) {
    const changed = await request.patch(`${apiBase}/v1/projects/${project.id}/extensions/${instanceId}`, {
      data: { enabled },
    });
    expect(changed.ok()).toBe(true);
    const greeting = dialog.getByRole("group", { name: "Shortcut greeting", exact: true });
    if (enabled) await expect(greeting).toHaveCount(1);
    else await expect(greeting).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
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
  await expect(
    page.getByRole("dialog").last().getByRole("group", { name: "Shortcut greeting", exact: true }),
  ).toHaveCount(0);
});

test("the theme picker opens on the current theme and Escape keeps it", { tag: "@smoke" }, async ({
  page,
  request,
}) => {
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
    await page.keyboard.press("Alt+Shift+Space");
    await page.keyboard.press("s");
    await page.keyboard.press("t");
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

test("changes and saves the theme through the command palette", { tag: "@smoke" }, async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Command palette theme" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
    if (!localStorage.getItem("theme-preference")) localStorage.setItem("theme-preference", "pstdio-dark");
  }, project.id);
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: "Tickets", exact: true }).first()).toBeVisible();
  await changeThemeThroughCommandPalette(page);
});

test("main shortcuts navigate and open creation forms", { tag: "@smoke" }, async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Shortcut defaults" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.goto(`/projects/${project.id}/tickets`);
  await expect(page.getByRole("option", { name: /^Notes/ }).first()).toBeVisible({ timeout: 30_000 });
  for (const [key, label, destination] of [
    ["S", "Sessions", /\/sessions\/compose$/],
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
  await reference.getByRole("textbox", { name: "Search keyboard shortcuts" }).fill("New note");
  await expect(reference.getByRole("group", { name: "New note", exact: true }).first()).toContainText("Notes");
  await expect(
    reference.getByRole("group", { name: "New note", exact: true }).first().locator("kbd").first(),
  ).toBeVisible();
});
