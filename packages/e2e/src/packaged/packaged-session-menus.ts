import { expect, type Locator, type Page } from "@playwright/test";
import { serializePageUrl, workbenchPages } from "@pstdio/sdk/extensions";
import { verifyExtensionModeSessionRestore, verifyModePanelState } from "./packaged-mode-panel-state";
import { verifyPageSessionTab } from "./packaged-page-session-tab";
import { verifyClosedSidePreference, verifyGlobalBottomState } from "./packaged-related-resource-preferences";
import { verifySharedPageTab } from "./packaged-shared-page-tab";
import { verifyRetainedTerminalDrop } from "./packaged-tab-drop-pinning";

const createSessionFixture = async (baseUrl: string, projectId: string, authorization: Record<string, string>) => {
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
  return { workspace, session };
};

const verifyFloatingLauncher = async (page: Page) => {
  const floatSide = page.getByRole("button", { name: "Float Side Panel", exact: true });
  if (await floatSide.isVisible()) await floatSide.click();
  else await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  const floating = page.getByRole("dialog", { name: "Side Panel" });
  const launcher = page.getByRole("button", { name: "Open Side Panel", exact: true, includeHidden: true });
  await expect(launcher).toBeHidden();
  await floating.getByRole("button", { name: "Close Side Panel" }).click();
  await expect(launcher).toBeVisible();
  await launcher.focus();
  await page.keyboard.press("Enter");
  await expect(floating).toBeVisible();
  await expect(launcher).toBeHidden();
  await floating.getByRole("button", { name: "Reattach Side Panel" }).click();
};

const revealThenCloseSessionViewer = async (page: Page, row: Locator, projectId: string) => {
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/sessions/compose$`));
  const selected = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", {
    name: /Packaged session actions/,
  });
  await expect(selected).toHaveAttribute("aria-selected", "true");
  await selected.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(selected).toHaveCount(0);
};
const startNewSessionInViewer = async (page: Page, preview: Locator) => {
  await preview.focus();
  await page.keyboard.press("ControlOrMeta+Alt+s");
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("New session");
  await expect(page.locator('[data-workbench-panel="main"]')).toContainText("Project folder");
  await page.goBack();
  await expect(preview).toBeVisible();
  await preview.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menuitem", { name: "New session", exact: true }).click();
};

export const verifyPackagedSessionMenus = async (
  page: Page,
  baseUrl: string,
  projectId: string,
  authorization: Record<string, string>,
) => {
  const { workspace, session } = await createSessionFixture(baseUrl, projectId, authorization);
  const hideBottom = page.getByRole("button", { name: "Hide Bottom Panel", exact: true });
  if (await hideBottom.isVisible()) await hideBottom.click();
  const workspaceUrl = serializePageUrl({
    projectId,
    page: { id: "workspace", ref: workbenchPages.workspace, path: "workspace" },
    resource: { type: "workspace", id: workspace.id },
  });
  await page.goto(new URL(workspaceUrl, baseUrl).href);
  const preview = page
    .locator('[data-workbench-panel-header="side"]')
    .getByRole("tab", { name: /Packaged session actions/ });
  await expect(preview).toBeVisible();
  await preview.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "Pin tab", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(new URL(page.url()).pathname).toBe(new URL(workspaceUrl, baseUrl).pathname);
  const leaveWorkspace = () =>
    page
      .getByRole("navigation", { name: "breadcrumb" })
      .getByRole("button", { name: "Workspaces", exact: true })
      .click();
  const reopenWorkspace = () => page.goBack();
  await leaveWorkspace();
  await expect(preview).toBeHidden();
  await expect(page.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await reopenWorkspace();
  await expect(preview).toBeVisible();
  await preview.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await expect(page.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await leaveWorkspace();
  await reopenWorkspace();
  await verifyClosedSidePreference(page, preview, leaveWorkspace, reopenWorkspace);
  await startNewSessionInViewer(page, preview);
  const sideTabs = page.locator('[data-workbench-panel-header="side"]').getByRole("tab");
  await expect(sideTabs.filter({ hasText: "New session" })).toBeVisible();
  const sidePanel = page.locator('[data-workbench-panel="side"]').filter({ visible: true });
  const editor = sidePanel.getByTestId("content-editable").filter({ visible: true });
  await editor.fill("Packaged created session");
  await expect(sidePanel.getByRole("button", { name: "Send message", exact: true })).toBeEnabled();
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
  await verifyPageSessionTab(page, createdTab, leaveWorkspace, reopenWorkspace);
  await verifySharedPageTab(page, createdTab, leaveWorkspace, reopenWorkspace);
  const refresh = await fetch(`${baseUrl}/v1/sessions/${session.id}/title`, {
    method: "PATCH",
    headers: { ...authorization, "content-type": "application/json" },
    body: JSON.stringify({ title: "Packaged session actions" }),
  });
  expect(refresh.ok).toBe(true);
  await leaveWorkspace();
  await page.getByRole("button", { name: "Hide Side Panel", exact: true }).click();
  await reopenWorkspace();
  await expect(preview).toHaveCount(0);
  await expect(createdTab).toHaveAttribute("aria-selected", "true");
  await leaveWorkspace();
  await reopenWorkspace();
  await expect(preview).toHaveCount(0);
  await expect(createdTab).toHaveAttribute("aria-selected", "true");
  await leaveWorkspace();
  await expect(preview).toBeHidden();
  await expect(page.locator('[data-workbench-panel="side"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Side Panel", exact: true }).click();
  await expect(createdTab).toBeVisible();
  await reopenWorkspace();
  const bottomHeader = page.locator('[data-workbench-panel-header="secondary"]');
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  const terminalConnection = page.waitForEvent(
    "websocket",
    (socket) => new URL(socket.url()).pathname === "/v1/terminal",
  );
  await bottomHeader.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "Open terminal", exact: true }).click();
  const terminalSocket = await terminalConnection;
  const terminalWidgetId = await bottomHeader
    .locator('[data-workbench-tab]:has([role="tab"][aria-selected="true"])')
    .getAttribute("data-workbench-tab");
  expect(terminalWidgetId).toBeTruthy();
  const terminalTab = page.locator(`[data-workbench-tab=${JSON.stringify(terminalWidgetId)}]`).getByRole("tab");
  const terminalInput = page.getByRole("textbox", { name: "Terminal input" }).filter({ visible: true });
  await terminalInput.pressSequentially("export PSTDIO_NAVIGATION_STATE=retained");
  await terminalInput.press("Enter");
  await leaveWorkspace();
  await expect(terminalTab).toBeVisible();
  await expect(bottomHeader.getByRole("tab")).toHaveCount(1);
  await verifyGlobalBottomState(page, terminalTab, reopenWorkspace, leaveWorkspace);
  await verifyModePanelState(page, terminalTab);
  await verifyRetainedTerminalDrop(page, terminalTab);
  await terminalInput.pressSequentially('printf "__navigation_%s__\\n" "$PSTDIO_NAVIGATION_STATE"');
  await terminalInput.press("Enter");
  await expect(page.locator(".xterm:visible .xterm-rows")).toContainText("__navigation_retained__");
  const terminalClosed = terminalSocket.waitForEvent("close");
  await terminalTab.focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Close tab", exact: true }).click();
  await terminalClosed;
  await expect(page.locator('[data-workbench-panel="secondary"]:visible')).toHaveCount(0);
  await page.getByRole("button", { name: "Show Bottom Panel", exact: true }).click();
  await reopenWorkspace();
  await expect(page.getByRole("button", { name: "Hide Bottom Panel", exact: true })).toBeVisible();
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
  await verifyFloatingLauncher(page);
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
  await revealThenCloseSessionViewer(page, row, projectId);
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
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/sessions/compose$`));
  const deleted = await fetch(`${baseUrl}/v1/sessions/${session.id}`, { headers: authorization });
  expect(deleted.status).toBe(404);
  await verifyExtensionModeSessionRestore(page, projectId);
};
