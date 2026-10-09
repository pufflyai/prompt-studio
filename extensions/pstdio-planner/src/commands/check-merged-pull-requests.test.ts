import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { checkMergedPullRequestsCommand } from "./check-merged-pull-requests";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

test("a merged GitHub review link marks its ticket Done", async () => {
  const storage = createMemoryStorage();
  await statusesCollection(storage).put("done", { id: "done", name: "Done" } as never);
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "PR" } }));
  await ticketsCollection(storage).put(ticket.id, {
    ...ticket,
    reviewLinks: [
      {
        id: "review",
        provider: "github",
        kind: "pull_request",
        url: "https://github.com/acme/tools/pull/12",
        externalId: "12",
        title: null,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
      },
    ],
  });
  const commands: string[][] = [];
  await checkMergedPullRequestsCommand.run(
    ...makeCommandArgs({
      storage,
      params: {},
      overrides: {
        process: {
          run: async ({ command }) => {
            commands.push(command as string[]);
            return { exitCode: 0, stdout: '{"state":"MERGED"}', stderr: "" };
          },
        },
      },
    }),
  );
  expect(commands[0]).toEqual(["gh", "pr", "view", "https://github.com/acme/tools/pull/12", "--json", "state"]);
  expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("done");
});

test("checks many linked PRs with bounded parallel processes", async () => {
  const storage = createMemoryStorage();
  await statusesCollection(storage).put("done", { id: "done", name: "Done" } as never);
  const tickets = [];
  for (let number = 1; number <= 30; number++) {
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Merge" } }));
    await ticketsCollection(storage).put(ticket.id, {
      ...ticket,
      reviewLinks: [
        {
          id: String(number),
          provider: "github",
          kind: "pull_request",
          url: `https://github.com/acme/tools/pull/${number}`,
          externalId: String(number),
          title: null,
          createdAt: ticket.createdAt,
          updatedAt: ticket.updatedAt,
        },
      ],
    });
    tickets.push(ticket);
  }
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  await checkMergedPullRequestsCommand.run(
    ...makeCommandArgs({
      storage,
      params: {},
      overrides: {
        process: {
          run: async () => {
            calls++;
            active++;
            maxActive = Math.max(maxActive, active);
            await Bun.sleep(5);
            active--;
            return { exitCode: 0, stdout: '{"state":"MERGED"}', stderr: "" };
          },
        },
      },
    }),
  );
  expect(calls).toBe(30);
  expect(maxActive).toBeGreaterThan(1);
  expect(maxActive).toBeLessThanOrEqual(8);
  for (const ticket of tickets) expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("done");
});

for (const scenario of ["branch merged", "disabled", "open", "unavailable"]) {
  test(`GitHub merge check: ${scenario}`, async () => {
    const storage = createMemoryStorage();
    await statusesCollection(storage).put("done", { id: "done", name: "Done" } as never);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Branch" } }));
    let calls = 0;
    await checkMergedPullRequestsCommand.run(
      ...makeCommandArgs({
        storage,
        params: {},
        overrides: {
          settings: { get: async () => scenario !== "disabled" },
          workspaces: {
            list: async () => [{ id: "ws", branch: "feature/work", anchors_json: [{ type: "ticket", id: ticket.id }] }],
          },
          process: {
            run: async () => {
              calls++;
              return {
                exitCode: scenario === "unavailable" ? 1 : 0,
                stdout: scenario === "branch merged" ? '[{"number":1}]' : "[]",
                stderr: "not logged in",
              };
            },
          },
        },
      }),
    );
    expect(calls).toBe(scenario === "disabled" ? 0 : 1);
    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe(
      scenario === "branch merged" ? "done" : ticket.statusId,
    );
  });
}
