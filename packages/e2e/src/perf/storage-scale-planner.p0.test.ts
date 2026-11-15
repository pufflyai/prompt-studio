import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { createTicketCommand } from "pstdio-planner/src/commands/create-ticket";
import { runTicketsQuery } from "pstdio-planner/src/data/query";
import { compareRows, createRow, pageRows, workload } from "storage-scale-fixture";
import { fixtureCommands, plannerStorageIndexes } from "./storage-scale-extension";

test("Planner shows tickets created through its command and adopted by the fixture in view order", async () => {
  const storage = createMemoryStorage({ indexes: plannerStorageIndexes });
  const ctx = makeCommandContext({ storage, params: {}, resourcePrefixes: { ticket: "PS" } });
  // Planner builds against its released SDK, so its command context type differs from this package's.
  const planner = ctx as unknown as Parameters<typeof createTicketCommand.run>[0];
  const count = 60;
  const created = Array.from({ length: count }, (_, index) => createRow("rich", 9, index, 0)).sort(compareRows);
  const tickets: string[] = [];
  for (const row of created) tickets.push((await createTicketCommand.run(planner, { title: row.title })).id);
  const edited = created.map((row) => createRow("rich", 9, row.ordinal, 1));
  const command = fixtureCommands[0];
  const input = { action: "adopt" as const, planner: true, rows: edited, tickets, count };
  await command.run(makeCommandContext({ storage, params: { input } }), { input });
  const board = await runTicketsQuery({
    storage: planner.storage,
    resources: planner.resources,
    projectId: ctx.projectId,
  });
  const ready = board.rows.filter((row) => row.attributes.status === "ready").map((row) => row.title);
  expect(ready).toEqual(
    pageRows({ ...workload("rich"), rows: count }, 0, "focus", 0).map(
      (row) => createRow("rich", 9, row.ordinal, 1).title,
    ),
  );
});
