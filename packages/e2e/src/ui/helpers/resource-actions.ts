import { type APIRequestContext, expect, type Page } from "@playwright/test";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { folderProjectInput } from "../../helpers/folder-project";
import { switchSession } from "../../helpers/session-side-panel";
import { uiOrigin as apiBase } from "../../ui-server";

export const createResourceActionsProject = async (
  request: APIRequestContext,
  folderPath?: string,
  onCreated?: (project: { id: string }) => void,
) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Resource Actions" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  onCreated?.(project);
  const configured = await request.patch(`${apiBase}/v1/projects/${project.id}`, {
    data: { default_agent_id: "pstdio.workbench-fixture.harness.fake", default_agent_model: null },
  });
  expect(configured.ok()).toBe(true);
  return project;
};

export const prepareResourceActionsDashboard = async (page: Page, projectId: string) => {
  await page.addInitScript(
    ({ selectedProjectId }) => {
      if (window !== window.top) return;
      localStorage.setItem("onboarding-complete", "true");
      localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
      localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
      localStorage.setItem(
        `pstdio-project-settings/projects/${selectedProjectId}/values`,
        JSON.stringify({
          state: {
            lastSelectedAgent: "pstdio.workbench-fixture.harness.fake",
            lastSelectedModels: [],
            lastSelectedBranches: [],
            sessionModalState: "closed",
            selectedSessionId: null,
          },
          version: 0,
        }),
      );
    },
    { selectedProjectId: projectId },
  );
};

export const expectResourceMenuItems = async (page: Page, labels: string[]) => {
  for (const label of labels) {
    await expect(page.getByRole("menuitem", { name: label, exact: true })).toBeVisible();
  }
};

export const openSessionSidePanel = async (page: Page, title: string) => {
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const header = page.locator('[data-workbench-panel-header="side"]');
  const chooser = page.locator('[data-workbench-panel="side"]').getByRole("group", { name: "Available tabs" });
  await expect(header.getByRole("tab", { selected: true }).or(chooser)).toBeVisible();
  if (await chooser.isVisible()) await chooser.getByRole("button", { name: "New session", exact: true }).click();
  await header.getByRole("tab", { selected: true }).click({ button: "right" });
  await switchSession(page, title);
  const tab = page.locator('[data-workbench-panel-header="side"]').getByRole("tab", { name: title, exact: true });
  await tab.click({ button: "right" });
  // Provider navigation can already pin the selected destination. Preserve that state
  // instead of waiting for an action that only exists on a transient legacy tab.
  const pin = page.getByRole("menuitem", { name: "Pin tab", exact: true });
  const unpin = page.getByRole("menuitem", { name: "Unpin tab", exact: true });
  await expect(pin.or(unpin)).toBeVisible();
  if (await pin.count()) await pin.click();
  else {
    await expect(unpin).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expect(tab).toHaveCSS("font-style", "normal");
};

/**
 * Opens the attached Side Panel once the Sessions provider has loaded, so it starts with exactly its New session tab.
 * The Side shell can open before then; an empty Side Panel keeps offering the provider instead of placing its tab.
 */
export const openSideNewSession = async (page: Page) => {
  // The Sessions extension contributes its Sidenav entry together with its Side placement.
  await expect(page.getByRole("complementary").getByRole("option", { name: "Sessions", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const header = page.locator('[data-workbench-panel-header="side"]');
  const tabs = header.getByRole("tab");
  await expect(tabs).toHaveCount(1);
  await expect(tabs.first()).toHaveText("New session");
  return { header, panel: page.getByTestId("workbench-side-panel-attached"), tabs };
};

/** Adds a pinned New session tab from the Side header and returns it; existing tabs stay in place. */
export const addSideNewSession = async (page: Page) => {
  const header = page.locator('[data-workbench-panel-header="side"]');
  const tabs = header.getByRole("tab");
  const before = await tabs.evaluateAll((elements) => elements.map((element) => element.id));
  const add = header.getByRole("button", { name: "Add panel", exact: true });
  // Before the extension catalog arrives, + opens the sole built-in terminal directly.
  await expect(add).toHaveAttribute("aria-haspopup", "menu");
  await add.click();
  await page
    .getByRole("menu", { name: "Add panel" })
    .getByRole("menuitem", { name: "New session", exact: true })
    .click();
  await expect(tabs).toHaveCount(before.length + 1);
  for (const id of before) await expect(header.locator(`[id="${id}"]`)).toHaveCount(1);
  const added = header.locator(`[role="tab"]${before.map((id) => `:not([id="${id}"])`).join("")}`);
  await expect(added).toHaveText("New session");
  await expect(added).toHaveAttribute("aria-selected", "true");
  // Preview tabs are italic; + opens a pinned tab.
  await expect(added).toHaveCSS("font-style", "normal");
  return added;
};

/** Matches a page URL that still routes this conversation. Owners may canonicalise the reference, so compare what it names. */
export const isSessionUrl = (projectId: string, sessionId: string) => (url: URL) => {
  if (url.pathname !== `/projects/${projectId}/session`) return false;
  const resource = defaultPageResourceCodec.fromUri(url.searchParams.get("resource") ?? "");
  return resource?.type === "session" && resource.id === sessionId;
};
