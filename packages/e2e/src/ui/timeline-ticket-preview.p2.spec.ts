import { expect, test } from "@playwright/test";
import { folderProjectInput } from "../helpers/folder-project";
import { createPlannerTicket, executePlannerCommand } from "../helpers/planner-api";
import { uiOrigin } from "../ui-server";

test("timeline ticket selection keeps the planner visible and replaces the unpinned side preview", async ({
  page,
  request,
}) => {
  // Critical risk: selecting a ticket must not navigate away from the planner.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Timeline ticket previews" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    const first = await createPlannerTicket(request, uiOrigin, id, { content: "# First timeline ticket" });
    const second = await createPlannerTicket(request, uiOrigin, id, { content: "# Second timeline ticket" });
    await executePlannerCommand(request, uiOrigin, id, "update-ticket", {
      id: second.id,
      dependsOn: [first.id],
    });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const timelinePath = `/projects/${id}/extensions/pstdio.pstdio-planner/ticket-timeline`;
    await page.goto(timelinePath);
    const timeline = page.frameLocator('iframe[title="Project Timeline"]');
    const side = page.locator('[data-workbench-panel="side"]');
    await timeline.locator(`[data-ticket="${first.id}"]`).click();
    await expect(page).toHaveURL(timelinePath);
    await expect(side.getByRole("tab", { name: /First timeline ticket/ })).toBeVisible();
    await expect(side.getByText("First timeline ticket", { exact: true }).last()).toBeVisible();
    await side.getByText("First timeline ticket", { exact: true }).last().click();
    const firstCard = timeline.locator(`[data-ticket="${first.id}"] [data-testid="renderer-card"]`);
    await expect(firstCard).toHaveAttribute("data-selected", "true");
    await expect(timeline.locator('[data-edge-layer="hierarchy"] g')).toHaveCount(1);
    await expect(timeline.getByRole("button", { name: "Close details", exact: true })).toHaveCount(0);
    await side.getByRole("tab", { name: /First timeline ticket/ }).click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "Pin tab", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const next = timeline.locator(`[data-ticket="${second.id}"]`);
    await next.focus();
    await next.press("Enter");
    await expect(side.getByRole("tab", { name: /Second timeline ticket/ })).toBeVisible();
    await expect(side.getByRole("tab", { name: /First timeline ticket/ })).toHaveCount(0);
    await expect(firstCard).not.toHaveAttribute("data-selected", "true");
    await expect(next.getByTestId("renderer-card")).toHaveAttribute("data-selected", "true");
    await expect(page).toHaveURL(timelinePath);
    await expect(timeline.getByRole("button", { name: "Auto Build", exact: true })).toBeVisible();
    await side.getByRole("tab", { name: /Second timeline ticket/ }).click({ button: "right" });
    await page.getByRole("menuitem", { name: "Pin tab", exact: true }).click();
    await timeline.locator(`[data-ticket="${first.id}"]`).click();
    await expect(side.getByRole("tab", { name: /First timeline ticket/ })).toBeVisible();
    await expect(side.getByRole("tab", { name: /Second timeline ticket/ })).toBeVisible();
    await expect(firstCard).toHaveAttribute("data-selected", "true");
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("timeline tickets keep their preview while the attention bubble opens and resolves requests", async ({
  page,
  request,
}) => {
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Timeline pending requests" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    const ticket = await createPlannerTicket(request, uiOrigin, id, { content: "# Ticket awaiting input" });
    await executePlannerCommand(request, uiOrigin, id, "request-review", {
      ticket: ticket.id,
      title: "Confirm the timeline change",
      instructions: "Check the proposed behavior.",
      request: { kind: "task" },
    });
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    const timelinePath = `/projects/${id}/extensions/pstdio.pstdio-planner/ticket-timeline`;
    await page.goto(timelinePath);
    const timeline = page.frameLocator('iframe[title="Project Timeline"]');
    await timeline.locator(`[data-ticket="${ticket.id}"]`).click();
    const side = page.locator('[data-workbench-panel="side"]');
    await expect(side.getByRole("textbox")).toContainText("Ticket awaiting input");
    const card = timeline.locator(`[data-ticket="${ticket.id}"]`);
    await card.getByRole("button", { name: "1 item needs attention", exact: true }).click();
    const requests = timeline.getByRole("dialog");
    await expect(requests.getByText("Confirm the timeline change", { exact: true })).toBeVisible();
    await requests.getByRole("button", { name: "Confirm completed", exact: true }).click();
    await expect(requests).not.toBeVisible();
    await expect(card.getByRole("button", { name: "1 item resolved", exact: true })).toBeFocused();
    await expect(side.getByRole("textbox")).toContainText("Ticket awaiting input");
    await expect(timeline.locator(`[data-ticket="${ticket.id}"] [data-testid="renderer-card"]`)).toHaveAttribute(
      "data-selected",
      "true",
    );
    await expect(page).toHaveURL(timelinePath);
    await expect(timeline.getByRole("button", { name: "Auto Build", exact: true })).toBeVisible();
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});

test("selecting a gate preview keeps its gate review controls accessible", async ({ page, request }) => {
  // Critical risk: preview selection must not hide the only way to review a gate.
  const created = await request.post(`${uiOrigin}/v1/projects`, {
    data: folderProjectInput({ name: "Timeline gate selection" }),
  });
  expect(created.ok()).toBe(true);
  const { id } = await created.json();
  try {
    const configured = await request.patch(`${uiOrigin}/v1/projects/${id}`, {
      data: { default_agent_id: "pstdio.workbench-fixture.harness.fake" },
    });
    expect(configured.ok()).toBe(true);
    const gate = await executePlannerCommand<{ ticket: { id: string } }>(
      request,
      uiOrigin,
      id,
      "timeline.gate.create",
      { content: "# Review dependency gate" },
    );
    await page.addInitScript(() => {
      if (window === window.top) localStorage.setItem("onboarding-complete", "true");
    });
    const timelinePath = `/projects/${id}/extensions/pstdio.pstdio-planner/ticket-timeline`;
    await page.goto(timelinePath);
    const timeline = page.frameLocator('iframe[title="Project Timeline"]');
    await timeline.locator(`[data-ticket="${gate.ticket.id}"]`).click();
    await expect(
      page.locator('[data-workbench-panel="side"]').getByRole("tab", { name: /Review dependency gate/ }),
    ).toBeVisible();
    await expect(timeline.getByRole("button", { name: "Review gate", exact: true })).toBeVisible();
    await expect(page).toHaveURL(timelinePath);
  } finally {
    await request.delete(`${uiOrigin}/v1/projects/${id}`);
  }
});
