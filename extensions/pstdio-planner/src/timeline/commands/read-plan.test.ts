import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { putTicket, statusesCollection } from "../../data/collections";
import { DEFAULT_STATUSES } from "../../data/seed";
import { readPlanCommand } from "./read-plan";

test("uses Planner's configured status identities for progress, completion, and dependencies", async () => {
  const storage = createMemoryStorage();
  for (const status of DEFAULT_STATUSES) {
    await statusesCollection(storage).put(`project-${status.id}`, { ...status, id: `project-${status.id}` });
  }
  await statusesCollection(storage).put("project-wip", { ...DEFAULT_STATUSES[2]!, id: "project-wip", name: "WIP" });
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const completed = await createTicketCommand.run(ctx, {
    content: "# Finished prerequisite",
    statusId: "project-done",
  });
  const progress = await createTicketCommand.run(ctx, {
    content: "# Active work",
    statusId: "project-in-progress",
    dependsOn: [completed.id],
  });
  const blocked = await createTicketCommand.run(ctx, { content: "# Blocked work", statusId: "project-blocked" });
  const wip = await createTicketCommand.run(ctx, { content: "# Work in progress", statusId: "project-wip" });
  const plan = await readPlanCommand.run(ctx, {});
  expect(plan.ticketRows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: progress.id,
        attributes: expect.objectContaining({ status: "project-in-progress" }),
      }),
      expect.objectContaining({ id: wip.id, attributes: expect.objectContaining({ status: "project-wip" }) }),
    ]),
  );
  const rows = plan.sections.flatMap((section) => section.rows);
  expect(rows.find((row) => row.id === completed.id)).toMatchObject({ done: true, state: "done", status: "Done" });
  expect(rows.find((row) => row.id === progress.id)).toMatchObject({
    state: "in-progress",
    dependsOn: [{ id: completed.id, done: true }],
  });
  expect(rows.find((row) => row.id === blocked.id)).toMatchObject({
    state: "blocked",
    flags: expect.arrayContaining(["blocked"]),
  });
  expect(rows.find((row) => row.id === wip.id)).toMatchObject({ state: "in-progress", status: "WIP" });
});

test("waiting for prerequisites is distinct from a blocker on otherwise available work", async () => {
  const storage = createMemoryStorage();
  const [ctx] = makeCommandArgs({ storage, params: {} });
  const prerequisite = await createTicketCommand.run(ctx, { content: "# Prerequisite", statusId: "ready" });
  const waiting = await createTicketCommand.run(ctx, {
    content: "# Waiting for a prerequisite",
    statusId: "ready",
    dependsOn: [prerequisite.id],
  });
  const deferredBlocker = await createTicketCommand.run(ctx, {
    content: "# Waiting with an external blocker",
    statusId: "blocked",
    dependsOn: [prerequisite.id],
  });
  await putTicket(storage, { ...deferredBlocker, blockedReason: "Missing credentials" });
  const availableBlocker = await createTicketCommand.run(ctx, {
    content: "# Available but blocked",
    statusId: "ready",
  });
  await putTicket(storage, { ...availableBlocker, blockedReason: "Missing credentials" });

  const plan = await readPlanCommand.run(ctx, {});
  const rows = plan.sections.flatMap((section) => section.rows);
  for (const ticket of [waiting, deferredBlocker]) {
    const row = rows.find((row) => row.id === ticket.id)!;
    expect(row.state).toBe("not-started");
    expect(row.flags).toContain("waiting");
    expect(row.flags).not.toContain("blocked");
  }
  expect(rows.find((row) => row.id === availableBlocker.id)).toMatchObject({
    state: "blocked",
    flags: expect.arrayContaining(["blocked"]),
  });
  expect(plan.sections[0]!.counts.blocked).toBe(1);

  await putTicket(storage, { ...prerequisite, statusId: "done" });
  const available = (await readPlanCommand.run(ctx, {})).sections.flatMap((section) => section.rows);
  expect(available.find((row) => row.id === waiting.id)?.flags).not.toContain("waiting");
  expect(available.find((row) => row.id === deferredBlocker.id)).toMatchObject({
    state: "blocked",
    flags: expect.arrayContaining(["blocked"]),
  });
});
