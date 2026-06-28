import { expect, test } from "@playwright/test";
import { createPlannerTicket, createPlannerTicketFile, getPlannerTicketStatuses } from "../helpers/planner-api";

const apiPort = Number(process.env.E2E_API_PORT ?? "3200");
const apiBase = `http://localhost:${apiPort}`;

const deleteAllProjects = async (request: import("@playwright/test").APIRequestContext) => {
  const res = await request.get(`${apiBase}/v1/projects`);
  expect(res.ok()).toBe(true);

  const projects = (await res.json()) as { id: string }[];
  for (const project of projects) {
    await request.delete(`${apiBase}/v1/projects/${project.id}`);
  }
};

const createProjectViaApi = async (request: import("@playwright/test").APIRequestContext, name: string) => {
  const res = await request.post(`${apiBase}/v1/projects`, { data: { name } });
  expect(res.ok()).toBe(true);
  return (await res.json()) as { id: string; name: string };
};

const bypassOnboarding = async (page: import("@playwright/test").Page, projectId: string) => {
  await page.addInitScript((selectedProjectId) => {
    localStorage.setItem("onboarding-complete", "true");
    localStorage.setItem("selected-agent", "pstdio.harness-lab.fake");
    localStorage.setItem("dashboard-wb:selected-project:global", selectedProjectId);
  }, projectId);
};

const longMarkdown = (label: string) =>
  Array.from({ length: 120 }, (_, index) => `${label} line ${String(index + 1).padStart(3, "0")}`).join("\n\n");

const editorScrollTop = async (page: import("@playwright/test").Page) => {
  const editor = page.getByTestId("content-editable").first();
  await expect(editor).toBeVisible();
  return editor.evaluate((element) => {
    const ancestors: HTMLElement[] = [];
    let current: HTMLElement | null = element;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }
    const scrollableAncestors = ancestors.filter((ancestor) => {
      const overflowY = getComputedStyle(ancestor).overflowY;
      return ancestor.scrollHeight > ancestor.clientHeight && ["auto", "scroll", "overlay"].includes(overflowY);
    });
    const scrollOwner = scrollableAncestors.at(-1);
    if (!scrollOwner) throw new Error("Scroll viewport not found");
    return scrollOwner.scrollTop;
  });
};

const scrollEditorToBottom = async (page: import("@playwright/test").Page) => {
  const editor = page.getByTestId("content-editable").first();
  await expect(editor).toBeVisible();
  await editor.evaluate((element) => {
    const ancestors: HTMLElement[] = [];
    let current: HTMLElement | null = element;
    while (current) {
      ancestors.push(current);
      current = current.parentElement;
    }
    const scrollableAncestors = ancestors.filter((ancestor) => {
      const overflowY = getComputedStyle(ancestor).overflowY;
      return ancestor.scrollHeight > ancestor.clientHeight && ["auto", "scroll", "overlay"].includes(overflowY);
    });
    const scrollOwner = scrollableAncestors.at(-1);
    if (!scrollOwner) throw new Error("Scroll viewport not found");
    scrollOwner.scrollTop = scrollOwner.scrollHeight;
  });
};

test("resets markdown scroll when switching from a ticket file back to the ticket", async ({ page, request }) => {
  await deleteAllProjects(request);
  const project = await createProjectViaApi(request, "Ticket Scroll Reset Project");
  const statuses = await getPlannerTicketStatuses(request, apiBase, project.id);
  const defaultStatus = statuses.find((status) => status.isDefault) ?? statuses[0];
  expect(defaultStatus).toBeTruthy();

  const ticket = await createPlannerTicket(request, apiBase, project.id, {
    content: longMarkdown("ticket-scroll-reset"),
    statusId: defaultStatus!.id,
  });
  await createPlannerTicketFile(request, apiBase, project.id, ticket.id, {
    name: "scroll-proof.md",
    content: longMarkdown("file-scroll-reset"),
  });
  await bypassOnboarding(page, project.id);
  await page.goto("/");
  await page.getByRole("option", { name: "Tickets", exact: true }).click();

  const card = page.getByTestId("renderer-card").filter({ hasText: ticket.title }).first();
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.click();

  await expect(page.getByTestId("content-editable").first().getByText("ticket-scroll-reset line 001")).toBeVisible();
  await scrollEditorToBottom(page);
  await expect.poll(() => editorScrollTop(page)).toBeGreaterThan(0);

  await expect(page.getByRole("option", { name: "scroll-proof" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("option", { name: "scroll-proof" }).click();
  await expect(page.getByText("file-scroll-reset line 001")).toBeVisible();
  await scrollEditorToBottom(page);
  await expect.poll(() => editorScrollTop(page)).toBeGreaterThan(0);

  await page.getByRole("option", { name: new RegExp(ticket.shorthand) }).click();
  await expect(page.getByTestId("content-editable").first().getByText("ticket-scroll-reset line 001")).toBeVisible();

  await expect.poll(() => editorScrollTop(page)).toBe(0);
});
