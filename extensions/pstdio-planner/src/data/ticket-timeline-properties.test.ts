import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { setTicketAttributeCommand } from "../commands/set-ticket-attribute";
import { createDeadlineCommand, deleteDeadlineCommand } from "../timeline/commands/deadline-commands";
import { moveTicketCommand } from "../timeline/commands/move-ticket";
import { readPlanCommand } from "../timeline/commands/read-plan";
import { runTicketsQuery } from "./query";

test("ticket properties expose milestone, date, progress, and attention from the same plan", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const milestone = (await createDeadlineCommand.run(ctx, { date: "2000-01-01", name: "Past release" }))!;
  const completed = await createTicketCommand.run(ctx, { content: "# Completed release work", statusId: "done" });
  const open = await createTicketCommand.run(ctx, { content: "# Waiting for release", statusId: "ready" });
  await moveTicketCommand.run(ctx, { ticket: completed.id, deadline: milestone.id });
  const query = await runTicketsQuery({ storage, projectId: ctx.projectId });
  expect(query.attributes?.find((attribute) => attribute.id === "milestone")?.type).toMatchObject({
    kind: "enum",
    options: expect.arrayContaining([{ value: milestone.id, label: "Past release", icon: "calendar" }]),
  });
  expect(query.rows.find((row) => row.id === completed.id)?.attributes).toMatchObject({
    milestone: milestone.id,
    milestoneDate: "2000-01-01",
    milestoneState: "completed-past",
    needsAttention: "no",
  });
  expect(query.rows.find((row) => row.id === open.id)?.attributes).toMatchObject({
    milestone: "",
    milestoneState: "unscheduled",
  });
  await moveTicketCommand.run(ctx, { ticket: open.id, deadline: milestone.id });
  const next = await runTicketsQuery({ storage, projectId: ctx.projectId });
  expect(next.rows.find((row) => row.id === open.id)?.attributes).toMatchObject({
    milestoneState: "open",
    needsAttention: "yes",
  });
  await deleteDeadlineCommand.run(ctx, { deadline: milestone.id });
  expect(
    (await runTicketsQuery({ storage, projectId: ctx.projectId })).rows.every((row) => row.attributes.milestone === ""),
  ).toBe(true);
});

test("ticket inline milestone edits update the plan without adding tag ids", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const milestone = (await createDeadlineCommand.run(ctx, { date: "2030-01-01", name: "Release" }))!;
  const ticket = await createTicketCommand.run(ctx, {
    content: "# Ticket created on either board",
    attributes: { priority: "default-priority-high" },
  });
  await setTicketAttributeCommand.run(ctx, { rowId: ticket.id, attributeId: "milestone", value: milestone.id });
  expect(ticket.tagIds).toEqual(["default-priority-high"]);
  expect(
    (await readPlanCommand.run(ctx, {})).sections
      .find((section) => section.deadline?.id === milestone.id)
      ?.rows.map((row) => row.id),
  ).toContain(ticket.id);
  await setTicketAttributeCommand.run(ctx, { rowId: ticket.id, attributeId: "milestone", value: "" });
  expect(
    (await runTicketsQuery({ storage, projectId: ctx.projectId })).rows.find((row) => row.id === ticket.id)?.attributes
      .milestone,
  ).toBe("");
  await setTicketAttributeCommand.run(ctx, { rowId: ticket.id, attributeId: "milestone", value: milestone.id });
  expect(
    (await runTicketsQuery({ storage, projectId: ctx.projectId })).rows.find((row) => row.id === ticket.id)?.attributes
      .milestone,
  ).toBe(milestone.id);
});

test("archived work does not change the active milestone progress", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const milestone = (await createDeadlineCommand.run(ctx, { date: "2000-01-01", name: "Released" }))!;
  const done = await createTicketCommand.run(ctx, { content: "# Shipped", statusId: "done" });
  const archived = await createTicketCommand.run(ctx, { content: "# Abandoned" });
  await moveTicketCommand.run(ctx, { ticket: done.id, deadline: milestone.id });
  await moveTicketCommand.run(ctx, { ticket: archived.id, deadline: milestone.id });
  await storage.collection("tickets").update(archived.id, { ...archived, archived: true });
  const query = await runTicketsQuery({ storage, projectId: ctx.projectId });
  expect(query.rows.find((row) => row.id === done.id)?.attributes.milestoneState).toBe("completed-past");
  expect(query.rows.find((row) => row.id === archived.id)?.attributes.milestone).toBe("");
  expect(
    (await readPlanCommand.run(ctx, {})).sections.find((section) => section.deadline?.id === milestone.id)?.counts,
  ).toMatchObject({ total: 1, done: 1 });
});
