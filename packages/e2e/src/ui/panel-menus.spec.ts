import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

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
  await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-planner\/ticket\?resource=/);

  await page.goBack();
  await expect(page).toHaveURL(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);

  await page.reload();
  await page.goForward();
  await expect(page).toHaveURL(/\/extensions\/pstdio\.pstdio-planner\/ticket\?resource=/);
  await expect(page.getByRole("region", { name: "Main", exact: true }).getByRole("textbox")).toHaveText(ticket.content);
});

test("keeps the project selector and Session Panel available on project home", async ({ page, request }) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "PS-170 Project Chrome" }),
  });
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
  await page.getByRole("button", { name: "Open Side Panel" }).click();
  await page.getByRole("dialog", { name: "Side Panel" }).getByRole("button", { name: "Reattach Side Panel" }).click();
  const sideHeader = page.locator('[data-workbench-panel-header="side"]');
  await expect(sideHeader.getByRole("tab", { name: "New session", exact: true })).toBeVisible();
  await sideHeader.getByRole("button", { name: "Add panel" }).click();
  const sessionChoice = page
    .getByRole("menu", { name: "Add panel" })
    .getByRole("menuitem", { name: "Session", exact: true });
  if (await sessionChoice.isVisible()) await sessionChoice.click();
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
