import { expect, test } from "@playwright/test";
import { createPlannerTicket, getPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProject = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.post(`${apiBase}/v1/projects`, { data: { name: "Ticket editor lifecycle" } });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.extension-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const holdSelection = async (editor: import("@playwright/test").Locator, text: string) => {
  await editor.evaluate((element, selectedText) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.includes(selectedText)) node = walker.nextNode();
    if (!node?.textContent) throw new Error(`Selection text not found: ${selectedText}`);
    const start = node.textContent.indexOf(selectedText);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + selectedText.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    (window as typeof window & { __ps264Editor?: Element }).__ps264Editor = element;
  }, text);
};

const editorSelectionState = (editor: import("@playwright/test").Locator) =>
  editor.evaluate((element) => {
    const selection = window.getSelection();
    return {
      active: document.activeElement === element || element.contains(document.activeElement),
      collapsed: selection?.isCollapsed,
      sameEditor: (window as typeof window & { __ps264Editor?: Element }).__ps264Editor === element,
      text: selection?.toString(),
    };
  });

test("keeps ticket editor focus and selection across debounce and save", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProject(request);
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const status = statuses.find((candidate) => candidate.isDefault) ?? statuses[0];
  expect(status).toBeTruthy();
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# Lifecycle proof\n\nHold this selection across save.",
    statusId: status!.id,
  });
  await bypassOnboarding(page, project.id);
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();
  const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  const editor = page.locator('[role="textbox"]:visible').first();
  await expect(editor).toContainText("Hold this selection across save.");
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" Saved marker.");
  await holdSelection(editor, "Hold this selection");

  await page.waitForTimeout(700);
  await expect
    .poll(() => editorSelectionState(editor))
    .toEqual({
      active: true,
      collapsed: false,
      sameEditor: true,
      text: "Hold this selection",
    });
  await expect
    .poll(async () => (await getPlannerTicket(request, apiBase, project.id, ticket.id))?.content)
    .toContain("Saved marker.");
  await expect
    .poll(() => editorSelectionState(editor))
    .toEqual({
      active: true,
      collapsed: false,
      sameEditor: true,
      text: "Hold this selection",
    });
});
