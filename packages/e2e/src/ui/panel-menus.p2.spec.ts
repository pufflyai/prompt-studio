import { folderProjectInput } from "../helpers/folder-project";
import { homeFrame } from "../helpers/home-loading";
import { createPlannerTicket } from "../helpers/planner-api";
import { switchSession } from "../helpers/session-side-panel";
import { verifyNativePublicTextEditor } from "../helpers/verify-public-text-editor";
import { expect, test } from "../scripts/session-test";
import { uiOrigin as apiBase } from "../ui-server";
import { addSideNewSession, openSideNewSession } from "./helpers/resource-actions";

const openTabCustomMenu = async (tab: import("@playwright/test").Locator) => {
  await tab.click({ button: "right" });
};
const createSession = async (
  request: import("@playwright/test").APIRequestContext,
  projectId: string,
  title: string,
) => {
  const response = await request.post(`${apiBase}/v1/sessions`, {
    data: {
      project_id: projectId,
      title,
      prompt: title,
      agent: "pstdio.workbench-fixture.harness.fake",
    },
  });
  expect(response.ok()).toBe(true);
};

test("preserves browser Forward history between extension pages after refresh", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-170 History" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "Forward history ticket",
  });
  await page.goto(`/projects/${project.id}`);

  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  await page.getByText(ticket.content, { exact: true }).click();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.planner\/ticket\?resource=/);

  await page.goBack();
  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.planner/tickets`);

  await page.reload();
  await page.goForward();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.planner\/ticket\?resource=/);
  await verifyNativePublicTextEditor(page, ticket.content);
});

test("preserves other Session tabs when selecting from New session", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-170 Session Sub Panels" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await createSession(request, project.id, "First context session");
  await createSession(request, project.id, "Second context session");
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  // Project boot can still apply its saved panel layout after the shell mounts.
  await expect(homeFrame(page).getByText("Project home", { exact: true })).toBeVisible();
  const { header: sideHeader, tabs: sessionTabs } = await openSideNewSession(page);
  await addSideNewSession(page);

  await openTabCustomMenu(sessionTabs.first());
  const menu = page.getByRole("menu", { name: "New session context menu" });
  const newSession = menu.getByRole("menuitem", { name: "New session" });
  await expect(newSession).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toContainText("New session");
  await expect(menu.getByRole("menuitem", { name: "Unpin tab", exact: true })).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: "Reset layout", exact: true })).toBeVisible();
  await expect(menu.getByRole("group", { name: "Sessions", exact: true })).toBeVisible();
  await expect(menu.getByRole("group", { name: "Tab", exact: true })).toBeVisible();

  await switchSession(page, "First context session");
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await switchSession(page, "Second context session");
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /New session/ }));
  await switchSession(page, "First context session");
  await expect(sessionTabs).toHaveCount(2);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sideHeader.getByRole("tab", { name: /New session/ })).toHaveCount(0);
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await switchSession(page, "Second context session");
  await expect(sessionTabs).toHaveCount(2);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const before = await sessionTabs.evaluateAll((tabs) => tabs.map((tab) => ({ id: tab.id, title: tab.textContent })));
  const origin = before.find((tab) => tab.title === "First context session")!;
  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await page
    .getByRole("menu", { name: "First context session context menu" })
    .getByRole("menuitem", { name: "New session", exact: true })
    .click();
  await expect(sessionTabs).toHaveCount(before.length);
  for (const [index, tab] of before.entries()) {
    await expect(sessionTabs.nth(index)).toHaveAttribute("id", tab.id);
    await expect(sessionTabs.nth(index)).toHaveText(tab.id === origin.id ? "New session" : tab.title!);
  }
  await expect(sideHeader.getByRole("tab", { selected: true })).toHaveAttribute("id", origin.id);
  await expect(page.getByRole("region", { name: "Side Panel" })).toBeVisible();
});

test("switches a pinned Session tab in place from its menu", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Pinned Session tab menu" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await createSession(request, project.id, "First context session");
  await createSession(request, project.id, "Second context session");
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  // Project boot can still apply its saved panel layout after the shell mounts.
  await expect(homeFrame(page).getByText("Project home", { exact: true })).toBeVisible();
  const { header: sideHeader, tabs: sessionTabs } = await openSideNewSession(page);
  const previewId = await sessionTabs.first().getAttribute("id");
  // The + button opens a pinned tab; its menu must switch that tab and leave the preview alone.
  const pinned = await addSideNewSession(page);
  for (const title of ["First context session", "Second context session"]) {
    await openTabCustomMenu(pinned);
    await switchSession(page, title);
    await expect(sessionTabs).toHaveCount(2);
    await expect(pinned).toHaveText(title);
    await expect(pinned).toHaveAttribute("aria-selected", "true");
    await expect(sideHeader.locator(`[id="${previewId}"]`)).toHaveText("New session");
  }
});

test("updates a New session Sub Panel in place after the first message", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-170 Draft Session" }),
  });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  const updateResponse = await request.patch(`${apiBase}/v1/projects/${project.id}`, {
    data: { default_agent_id: "pstdio.workbench-fixture.harness.fake" },
  });
  expect(updateResponse.ok()).toBe(true);
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem(
      `pstdio-dashboard:command-params:recent-harness:${projectId}`,
      JSON.stringify({ harnessId: "pstdio.workbench-fixture.harness.fake" }),
    );
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);
  await page.goto(`/projects/${project.id}/`);
  // Project boot can still apply its saved panel layout after the shell mounts.
  await expect(homeFrame(page).getByText("Project home", { exact: true })).toBeVisible();
  const { header: sideHeader, panel: sidePanel, tabs: sessionTabs } = await openSideNewSession(page);
  const added = await addSideNewSession(page);
  const activeTab = sideHeader.getByRole("tab", { selected: true });
  await expect(activeTab).toHaveAttribute("id", (await added.getAttribute("id"))!);

  const prompt = "Continue in this session tab";
  await sidePanel
    .locator("[data-testid='content-editable'][contenteditable='true']")
    .filter({ visible: true })
    .fill(prompt);
  await sidePanel.getByTestId("send-message-button").filter({ visible: true }).click();

  await expect(sessionTabs).toHaveCount(2);
  await expect(activeTab).toContainText(prompt);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/extensions/pstdio\\.home/home$`));
});

test("renames a moved session and restores its destination after reload", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Arrange session" }),
  });
  const project = await response.json();
  await createSession(request, project.id, "Session to rename");
  await page.addInitScript((id) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", id);
  }, project.id);
  await page.goto(`/projects/${project.id}/sessions`);
  await page.getByRole("button", { name: "Open Side Panel", exact: true }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const side = page.locator('[data-workbench-panel-header="side"]');
  // The Sessions page owns its Main composer; explicitly add the Side Panel instance to move.
  // Before the extension catalog arrives, + opens the sole built-in terminal directly.
  await expect(side.getByRole("button", { name: "Add panel", exact: true })).toHaveAttribute("aria-haspopup", "menu");
  await side.getByRole("button", { name: "Add panel", exact: true }).click();
  await page.getByRole("menuitem", { name: "New session", exact: true }).click();
  await openTabCustomMenu(side.getByRole("tab", { name: "New session", exact: true, selected: true }));
  await switchSession(page, "Session to rename");
  await openTabCustomMenu(side.getByRole("tab", { name: "Session to rename", exact: true }));
  await page.getByRole("menuitem", { name: "Move to Secondary", exact: true }).click();
  const bottom = page.locator('[data-workbench-panel-header="secondary"]');
  const moved = bottom.getByRole("tab", { name: "Session to rename", exact: true });
  await expect(moved).toBeVisible();
  const instance = await moved.locator("..").getAttribute("data-workbench-tab");
  expect(instance).toBeTruthy();
  await openTabCustomMenu(moved);
  await page.getByRole("menuitem", { name: "Rename session", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Rename session", exact: true });
  await dialog.getByRole("textbox").fill("Renamed session");
  await dialog.getByRole("button", { name: "Run", exact: true }).click();
  await expect(bottom.getByRole("tab", { name: "Renamed session", exact: true })).toBeVisible();
  await page.reload();
  await expect(bottom.getByRole("tab", { name: "Renamed session", exact: true })).toBeVisible();
  expect(
    await bottom
      .getByRole("tab", { name: "Renamed session", exact: true })
      .locator("..")
      .getAttribute("data-workbench-tab"),
  ).toBe(instance);
});
