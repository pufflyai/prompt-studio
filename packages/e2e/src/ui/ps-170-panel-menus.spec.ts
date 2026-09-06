import { expect, type Locator, type Page, test } from "@playwright/test";
import { createPlannerTicket } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const openTabCustomMenu = async (tab: import("@playwright/test").Locator) => {
  if ((await tab.getAttribute("aria-selected")) !== "true") await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await tab.click();
};
interface MenuCase {
  panel: "Main" | "Secondary" | "Side";
  side: "left" | "right";
  contentRegion: "main" | "secondary" | "side";
}

const _testedMenus: MenuCase[] = [
  { panel: "Main", side: "left", contentRegion: "main" },
  { panel: "Secondary", side: "right", contentRegion: "secondary" },
  { panel: "Side", side: "left", contentRegion: "side" },
];

const panelId = (panel: MenuCase["panel"]) => panel.toLowerCase();
const _menuName = (entry: MenuCase) => `${entry.panel} ${entry.side} menu`;
const _menuRegion = (page: Page, entry: MenuCase) =>
  page.locator(`[data-workbench-panel-menu="${panelId(entry.panel)}-${entry.side}"]`);

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

const _dragMenuClosed = async (page: Page, menu: Locator, separator: Locator, side: MenuCase["side"]) => {
  const [menuBox, separatorBox] = await Promise.all([menu.boundingBox(), separator.boundingBox()]);
  expect(menuBox).not.toBeNull();
  expect(separatorBox).not.toBeNull();
  const startX = separatorBox!.x + separatorBox!.width / 2;
  const y = separatorBox!.y + separatorBox!.height / 2;
  const targetX = side === "left" ? menuBox!.x + 40 : menuBox!.x + menuBox!.width - 40;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(targetX, y);
  await page.mouse.up();
};

test("PS-170 preserves browser Forward history between extension pages after refresh", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 History" } });
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
  await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-planner\/ticket\?resource=/);

  await page.goBack();
  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);

  await page.reload();
  await page.goForward();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-planner\/ticket\?resource=/);
  await expect(page.getByText(ticket.content, { exact: true })).toBeVisible();
});

test("PS-170 keeps the project selector and Session Panel available on project home", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Project Chrome" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);

  await page.goto(`/projects/${project.id}/`);

  await expect(
    page.getByRole("region", { name: "Nav Chrome" }).getByRole("button", { name: "Switch project", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toBeVisible();
});

test("PS-170 preserves other Session tabs when selecting from New session", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Session Sub Panels" } });
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
  await page.getByRole("button", { name: "Open Side Panel" }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const sideHeader = page.locator('[data-workbench-panel-header="side"]');
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  const sessionTabs = sideHeader.getByRole("tab");
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sessionTabs.first());
  const menu = page.getByRole("menu", { name: "New session menu" });
  const newSession = menu.getByRole("menuitem", { name: "New session" });
  const viewAllSessions = menu.getByRole("menuitem", { name: "View all sessions" });
  await expect(newSession).toBeVisible();
  await expect(viewAllSessions).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toContainText("New session");
  await expect(menu.getByRole("menuitem").last()).toContainText("View all sessions");
  await expect(menu.getByRole("separator")).toHaveCount(2);
  await expect(viewAllSessions.locator("svg")).toHaveClass(/lucide-arrow-up-right/);

  await menu.getByRole("menuitem", { name: "First context session" }).click();
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(3);

  const firstNewSessionTab = sideHeader.getByRole("tab", { name: /New session/ }).first();
  await firstNewSessionTab.click();
  await firstNewSessionTab.getByRole("button", { name: "Close New session" }).click();
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await page
    .getByRole("menu", { name: "First context session menu" })
    .getByRole("menuitem", { name: "Second context session" })
    .click();
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sessionTabs).toHaveCount(2);

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /New session/ }));
  await page
    .getByRole("menu", { name: "New session menu" })
    .getByRole("menuitem", { name: "First context session" })
    .click();
  await expect(sessionTabs).toHaveCount(3);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toBeVisible();
  await expect(sideHeader.getByRole("tab", { name: /New session/ })).toBeVisible();
  await expect(sideHeader.getByRole("tab", { name: /First context session/ })).toBeVisible();

  await openTabCustomMenu(sideHeader.getByRole("tab", { name: /First context session/ }));
  await page
    .getByRole("menu", { name: "First context session menu" })
    .getByRole("menuitem", { name: "Second context session" })
    .click();
  await expect(sessionTabs).toHaveCount(3);
  await expect(sideHeader.getByRole("tab", { name: /Second context session/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("region", { name: "Side Panel" })).toBeVisible();
});

test("PS-170 updates a New session Sub Panel in place after the first message", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Draft Session" } });
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
  await page.getByRole("button", { name: "Open Side Panel" }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const sideHeader = page.locator('[data-workbench-panel-header="side"]');
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  const sessionTabs = sideHeader.getByRole("tab");
  const activeTab = sideHeader.getByRole("tab", { selected: true });
  await expect(sessionTabs).toHaveCount(2);
  await expect(activeTab).toContainText("New session");

  const prompt = "Continue in this session tab";
  await page.locator("[data-testid='content-editable'][contenteditable='true']").last().fill(prompt);
  await page.locator("[data-testid='send-message-button']").last().click();

  await expect(sessionTabs).toHaveCount(2);
  await expect(activeTab).toContainText(prompt);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/?$`));
});

test("PS-170 hides unavailable Side Panel chrome in the Sessions Location", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "PS-170 Empty Sessions" } });
  expect(response.ok()).toBe(true);
  const project = (await response.json()) as { id: string };
  await page.addInitScript((projectId: string) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("dashboard-wb2:selected-project:global", projectId);
  }, project.id);

  await page.goto(`/projects/${project.id}/sessions`);

  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByText("Sessions", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Show Side Panel" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Side Panel" })).toHaveCount(0);
  await expect(page.getByTestId("workbench-side-panel-floating")).toHaveCount(0);
});
