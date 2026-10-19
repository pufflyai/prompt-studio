import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { attemptEventsCollection, putAttempt } from "../data/attempt-storage";
import { STATUSES_COLLECTION, statusesCollection, TICKETS_COLLECTION, ticketsCollection } from "../data/collections";
import { DEFAULT_STATUSES } from "../data/seed";
import type { StoredTicket } from "../data/types";
import { loadAttemptReadiness } from "./attempt-readiness";
import { checkMergedPullRequestsCommand } from "./check-merged-pull-requests";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { stackSubmissionFixture } from "./stack-submission.fixture";

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
  expect(commands[0]).toEqual([
    "gh",
    "pr",
    "view",
    "https://github.com/acme/tools/pull/12",
    "--json",
    "state,mergeCommit,headRefOid",
  ]);
  expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe("done");
});

test("checks many linked PRs with bounded parallel processes", async () => {
  const started = performance.now();
  const now = new Date().toISOString();
  const tickets: StoredTicket[] = Array.from({ length: 30 }, (_, index) => {
    const number = index + 1;
    return {
      id: crypto.randomUUID(),
      shorthand: `T-${number}`,
      title: "Merge",
      content: "",
      statusId: "backlog",
      tagIds: [],
      attachments: [],
      parentId: null,
      dependsOn: [],
      blockedReason: null,
      userPrompt: null,
      draft: false,
      archived: false,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
      reviewLinks: [
        {
          id: String(number),
          provider: "github",
          kind: "pull_request",
          url: `https://github.com/acme/tools/pull/${number}`,
          externalId: String(number),
          title: null,
          createdAt: now,
          updatedAt: now,
        },
      ],
    };
  });
  // Seed the existing PR links directly so setup only writes their starting state.
  const storage = createMemoryStorage({
    collections: {
      [STATUSES_COLLECTION]: Object.fromEntries(DEFAULT_STATUSES.map((status) => [status.id, status])),
      [TICKETS_COLLECTION]: Object.fromEntries(tickets.map((ticket) => [ticket.id, ticket])),
    },
  });
  await ticketsCollection(storage).list();
  console.log(`Linked PR phase: fixture ready in ${performance.now() - started}ms`);
  const checking = performance.now();
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
  console.log(`Linked PR phase: check completed in ${performance.now() - checking}ms`);
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

test.each([true, false])("GitHub merge evidence must match the submitted revision (matching: %s)", async (matching) => {
  const f = await stackSubmissionFixture();
  try {
    await f.ticket("Parent");
    await f.ticket("Child", ["Parent"]);
    await f.git("checkout", "-b", "parent");
    const head = await f.commit("parent.txt");
    await f.git("checkout", "main");
    const ticket = (await ticketsCollection(f.storage).get("Parent"))!;
    await ticketsCollection(f.storage).put(ticket.id, {
      ...ticket,
      reviewLinks: [
        {
          id: "pr",
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
    await putAttempt(f.storage, {
      ...f.attempt,
      workspaceId: "parent",
      ticketId: ticket.id,
      state: "review_ready",
      revisions: [
        {
          revision: 1,
          baseSha: f.base,
          headSha: head,
          changeRequestReportId: "parent-report",
          submittedAt: new Date().toISOString(),
          submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
          reviews: [],
        },
      ],
    });
    const run = f.ctx.process.run;
    f.ctx.process.run = async (input) =>
      input.command[0] === "gh"
        ? {
            exitCode: 0,
            stderr: "",
            stdout: JSON.stringify({
              state: "MERGED",
              headRefOid: matching ? head : f.base,
              mergeCommit: { oid: "1111111111111111111111111111111111111111" },
            }),
          }
        : run(input);
    await checkMergedPullRequestsCommand.run(f.ctx, {});
    expect((await ticketsCollection(f.storage).get(ticket.id))?.statusId).toBe(matching ? "done" : ticket.statusId);
    const records = (await attemptEventsCollection(f.storage).list()).filter(
      (event) => event.type === "attempt_merged",
    );
    expect(records).toHaveLength(matching ? 1 : 0);
    if (matching)
      expect((await loadAttemptReadiness(f.ctx, "Child", { base: "main" })).readiness).toMatchObject({
        mode: "stacked",
        baseHeadSha: head,
      });
  } finally {
    await f.cleanup();
  }
});
