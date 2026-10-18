import { expect, type Page } from "@playwright/test";
import { serializePageUrl, workbenchPages } from "@pstdio/sdk/extensions";

export const verifyPackagedSessionMenus = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const workspacesResponse = await fetch(`${baseUrl}/v1/workspaces?project_id=${projectId}`, {
    headers: authorization,
  });
  expect(workspacesResponse.ok).toBe(true);
  const workspaces = (await workspacesResponse.json()) as Array<{ id: string; is_default: boolean }>;
  const workspace = workspaces.find((workspace) => workspace.is_default)!;
  expect(workspace).toBeDefined();
  const response = await fetch(`${baseUrl}/v1/sessions`, {
    method: "POST",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({
      project_id: projectId,
      workspace_id: workspace.id,
      title: "Packaged session actions",
      prompt: "",
      agent: "pstdio.workbench-fixture.harness.fake",
    }),
  });
  expect(response.status).toBe(201);
  const session = (await response.json()) as { id: string };
  const workspaceUrl = serializePageUrl({
    projectId,
    page: { id: "workspace", ref: workbenchPages.workspace, path: "workspace" },
    resource: { type: "workspace", id: workspace.id },
  });
  await page.goto(new URL(workspaceUrl, baseUrl).href);
  const showSide = page.getByRole("button", { name: "Show Side Panel", exact: true });
  if (await showSide.isVisible()) await showSide.click();
  const preview = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: /Packaged session actions/ });
  await expect(preview).toBeVisible();
  await preview.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Pin tab", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(new URL(page.url()).pathname).toBe(new URL(workspaceUrl, baseUrl).pathname);
  await page.keyboard.press("ControlOrMeta+Alt+s");
  const sideTabs = page.locator('[data-workbench-panel-header="side"]').getByRole("tab");
  await expect(sideTabs.filter({ hasText: "New session" })).toBeVisible();
  const editor = page.getByTestId("content-editable").filter({ visible: true }).last();
  await editor.fill("Packaged created session");
  const created = page.waitForResponse(
    (response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/v1/sessions",
  );
  await editor.press("Enter");
  expect((await created).status()).toBe(201);
  await expect(sideTabs.filter({ hasText: "Packaged created session" })).toHaveAttribute("aria-selected", "true");
  expect(new URL(page.url()).pathname).toBe(new URL(workspaceUrl, baseUrl).pathname);
  await expect(sideTabs.first()).toContainText("Packaged created session");
  await expect(sideTabs.filter({ hasText: "Packaged session actions" })).toHaveCount(0);
  const createdTab = sideTabs.filter({ hasText: "Packaged created session" });
  await createdTab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.goto(`${baseUrl}/projects/${projectId}/sessions`);
  const row = page.locator('[data-workbench-region="sidenav"]').getByRole("option", {
    name: "Packaged session actions",
    exact: true,
  });
  await row.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toHaveCount(1);
  for (const name of ["Rename session", "Archive session", "Delete session"]) {
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  await page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { selected: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Switch session", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Switch session", exact: true });
  await picker.getByRole("textbox").fill("Packaged session actions");
  await expect(picker.getByRole("img", { name: "Session status: completed" })).toBeVisible();
  for (const title of ["Packaged session actions updated", "Packaged session actions"]) {
    const updated = await fetch(`${baseUrl}/v1/sessions/${session.id}/title`, {
      method: "PATCH",
      headers: { ...authorization, "content-type": "application/json" },
      body: JSON.stringify({ title }),
    });
    expect(updated.ok).toBe(true);
    await expect(picker.getByRole("option")).toHaveText([title]);
    await expect(picker.getByRole("textbox")).toHaveValue("Packaged session actions");
  }
  await picker.getByRole("textbox").press("Enter");
  await expect(
    page.locator('[data-workbench-panel-header="side"]').getByRole("tab", {
      name: /Packaged session actions/,
    }),
  ).toBeVisible();
  await page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: /Packaged session actions/ })
    .click({ button: "right" });
  await expect(page.getByRole("group", { name: "Session", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Sessions", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Tab", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await row.click();
  await expect(page).toHaveURL(new RegExp(session.id));
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Rename session", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Session name" }).fill("Packaged renamed session");
  await page.getByRole("button", { name: "Run", exact: true }).click();
  await expect(row).toBeHidden();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Packaged renamed session");
  await page.locator("[data-workbench-breadcrumb-resource-actions]").click();
  await page
    .locator('[role="menu"][data-state="open"]')
    .getByRole("menuitem", { name: "Delete session", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/sessions$`));
  const deleted = await fetch(`${baseUrl}/v1/sessions/${session.id}`, { headers: authorization });
  expect(deleted.status).toBe(404);
};
