import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { statusesCollection } from "../../data/collections";
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
