// Temporary comparison actions. Restore the fixture even when a baseline action fails.
import assert from "node:assert/strict";
import { join } from "node:path";
import { evidence, ids, measure, output, planner } from "./ps236-comparison-setup";

const pageRequest = { limit: 50, offset: 0, search: "", fields: ["title", "id", "status"] };
const order = (value: any) => value.sections.flatMap((s: any) => s.rows.map((r: any) => r.id));
const row = (value: any, id: string) => value.sections.flatMap((s: any) => s.rows).find((r: any) => r.id === id);

export const moveVisiblePair = async (page: any) => {
  const frame = page.frameLocator('iframe[title="Project Timeline"]');
  const before = order(await planner("timeline.plan.read", { page: pageRequest }));
  assert.equal(before.indexOf(ids[1]), before.indexOf(ids[0]) + 1);
  try {
    const moved = page.waitForResponse((reply: any) =>
      reply.url().endsWith("pstdio.planner.command.timeline.plan.move/execute"),
    );
    await measure("timeline-browser-drag", async () => {
      await frame
        .locator(`[data-ticket="${ids[1]}"]`)
        .getByTestId("renderer-card")
        .dragTo(frame.locator(`[data-ticket="${ids[0]}"]`).getByTestId("renderer-card"));
      const reply = await moved;
      assert.ok(reply.ok());
      const result = await reply.json();
      if (result.outcome?.status !== "success") throw new Error(JSON.stringify(result.outcome));
      assert.equal(result.outcome.value.ticketId, ids[1]);
    });
    evidence.browserTimelineMoved = ids[1];
    const after = order(await planner("timeline.plan.read", { page: pageRequest }));
    assert.ok(after.indexOf(ids[1]) < after.indexOf(ids[0]));
  } finally {
    await page.screenshot({ path: join(output, "timeline-after-drag.png"), fullPage: true });
    const current = order(await planner("timeline.plan.read", { page: pageRequest }));
    if (JSON.stringify(current) !== JSON.stringify(before))
      await planner("timeline.plan.move", { ticket: ids[0], before: ids[1] });
    assert.deepEqual(order(await planner("timeline.plan.read", { page: pageRequest })), before);
    evidence.browserDragStateRestored = true;
  }
};

export const moveLateTicket = async () => {
  assert.equal(evidence.browserDragStateRestored, true, "Skip mutation because prior fixture restore is unverified");
  const before = await planner("timeline.plan.read", { ticketId: ids[4998] });
  const deadline = await planner("timeline.deadline.create", { date: "2027-01-15", name: "Demo milestone" });
  try {
    await measure("timeline-move-late", () =>
      planner("timeline.plan.move", { ticket: ids[4999], deadline: deadline.id }),
    );
    const moved = await planner("timeline.plan.read", { ticketId: ids[4999] });
    assert.ok(
      moved.sections.some((s: any) => s.deadline?.id === deadline.id && s.rows.some((r: any) => r.id === ids[4999])),
    );
    const after = await planner("timeline.plan.read", { ticketId: ids[4998] });
    assert.ok(row(before, ids[4998]!));
    assert.ok(row(after, ids[4998]!));
    for (const key of ["id", "title", "deadlineId", "status"])
      assert.deepEqual(row(after, ids[4998]!)[key], row(before, ids[4998]!)[key]);
    evidence.timelineMove = { moved: ids[4999], untouched: ids[4998] };
  } finally {
    const current = await planner("timeline.plan.read", { ticketId: ids[4999] });
    if (row(current, ids[4999]!)?.deadlineId === deadline.id)
      await planner("timeline.plan.move", { ticket: ids[4999], deadline: "none" });
    await planner("timeline.deadline.delete", { deadline: deadline.id });
    const restored = await planner("timeline.plan.read", { ticketId: ids[4999] });
    assert.ok(restored.sections.some((s: any) => !s.deadline && s.rows.some((r: any) => r.id === ids[4999])));
    evidence.lateMoveStateRestored = true;
  }
};

export const archiveColumn = async (page: any, boardUrl: string) => {
  assert.equal(evidence.lateMoveStateRestored, true, "Skip mutation because prior fixture restore is unverified");
  const untouched = await planner("get-ticket", { id: ids[4998] });
  await page.goto(boardUrl, { waitUntil: "commit" });
  const box = page.getByRole("textbox", { name: "Search this view" });
  if (await box.isVisible()) await box.fill("");
  await page.getByRole("button", { name: "Column actions for Todo", exact: true }).click();
  const result = page.waitForResponse((reply: any) =>
    reply.url().endsWith("pstdio.planner.view.tickets.kanban.onColumnAction/execute"),
  );
  const archived = await measure("bulk-archive-browser", async () => {
    await page.getByRole("menuitem", { name: "Archive all", exact: true }).click();
    const reply = await result;
    assert.ok(reply.ok());
    const body = await reply.json();
    if (body.outcome?.status !== "success") throw new Error(JSON.stringify(body.outcome));
    return body.outcome.value;
  });
  assert.equal(archived.archivedCount, 1667);
  const after = await planner("get-ticket", { id: ids[4998] });
  assert.equal(after.archived, false);
  assert.equal(after.content, untouched.content);
  assert.equal((await planner("get-ticket", { id: ids[4996] })).archived, true);
  evidence.archived = archived;
  await page.screenshot({ path: join(output, "after-bulk-archive.png"), fullPage: true });
};
