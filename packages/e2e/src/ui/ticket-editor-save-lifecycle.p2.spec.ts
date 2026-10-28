import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, getPlannerTicket, getPlannerTicketStatuses } from "../helpers/planner-api";
import { uiOrigin as apiBase } from "../ui-server";

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const response = await request.get(`${apiBase}/v1/projects`);
  expect(response.ok()).toBe(true);
  const projects = (await response.json()) as { id: string }[];
  for (const project of projects) await request.delete(`${apiBase}/v1/projects/${project.id}`);
};

const createProject = async (request: import("@playwright/test").APIRequestContext, folderPath?: string) => {
  const response = await request.post(`${apiBase}/v1/projects`, {
    data: folderProjectInput({ name: "Ticket editor lifecycle" }, folderPath),
  });
  expect(response.ok()).toBe(true);
  return (await response.json()) as { id: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.workbench-fixture.harness.fake");
    localStorage.setItem("dashboard-wb2:selected-project:global", selectedProjectId);
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

test("loads ticket content independently of editor downloads", async ({ page, request }) => {
  const project = await createProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# First ticket load\n\nContent loads alongside the editor.",
  });
  await bypassOnboarding(page, project.id);
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
  await expect(card).toBeVisible();
  let release = () => {};
  const downloading = new Promise<void>((resolve) => {
    release = resolve;
  });
  let editorRequested = false;
  let contentRequested = false;
  const boardReloads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes(".view.ticket-editor.file.load/execute")) contentRequested = true;
    if (request.url().includes(".view.tickets.kanban.query/execute")) boardReloads.push(request.url());
  });
  await page.route(/markdown-editor[^/]*\.(?:js|tsx?)(?:\?|$)/, async (route) => {
    editorRequested = true;
    await downloading;
    await route.continue();
  });
  try {
    await card.click();
    await expect.poll(() => editorRequested).toBe(true);
    await expect.poll(() => contentRequested).toBe(true);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
  await expect(page.locator('[contenteditable="true"]').first()).toContainText("Content loads alongside the editor.");
  expect(boardReloads).toEqual([]);
});

test("recovers ticket editing after an editor download fails", async ({ page, request }) => {
  const project = await createProject(request);
  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: "# Editor download recovery\n\nThe saved ticket is still available.",
  });
  await bypassOnboarding(page, project.id);
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
  const editorModule = /markdown-editor[^/]*\.(?:js|tsx?)(?:\?|$)/;
  await page.route(editorModule, (route) => route.abort("failed"));
  await page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first().click();
  const reload = page.getByRole("button", { name: "Reload", exact: true });
  await expect(reload).toBeVisible();
  await page.unroute(editorModule);
  await reload.click();
  await expect(page.locator('[contenteditable="true"]').first()).toContainText("The saved ticket is still available.");
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
  await page.goto(`/projects/${project.id}/extensions/pstdio.pstdio-planner/tickets`);
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
