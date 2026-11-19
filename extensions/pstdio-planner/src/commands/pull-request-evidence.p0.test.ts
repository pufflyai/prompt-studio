import { expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { fixture } from "./auto-build.fixture";
import { readPullRequestEvidence } from "./pull-request-evidence";

test("delivery evidence follows the current revision across several linked PRs", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Correction");
  task.reviewLinks = [1, 2].map((n) => ({
    id: String(n),
    provider: "github",
    kind: "pull_request",
    url: `https://github.com/acme/tools/pull/${n}`,
    externalId: String(n),
    title: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }));
  await ticketsCollection(ctx).update(task.id, task);
  ctx.process.run = async ({ command }) => ({
    exitCode: 0,
    stdout: JSON.stringify({
      state: "OPEN",
      baseRefName: "main",
      headRefOid: command.includes(task.reviewLinks![1]!.url) ? "new-head" : "old-head",
      statusCheckRollup: [{ conclusion: "SUCCESS" }],
    }),
    stderr: "",
  });
  expect(await readPullRequestEvidence(ctx, task, "new-head")).toMatchObject({
    baseRefName: "main",
    headRefOid: "new-head",
  });
  expect(await readPullRequestEvidence(ctx, task, "missing-head")).toMatchObject({
    error: "No linked PR matches the current submitted revision.",
  });
});

test("sequential tickets share fresh PR evidence only within one query", async () => {
  const { ctx, ticket } = await fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  const { ticketReference } = await import("../data/pull-request-resources");
  for (const task of [first, second])
    await ctx.resources.addAnchors(ticketReference(ctx, task.id), [
      {
        type: "pull-request",
        extensionId: "pstdio.github",
        id: "https://github.com/acme/tools/pull/12",
        role: "result",
      },
    ]);
  let reads = 0;
  ctx.process.run = async () => {
    reads++;
    return {
      exitCode: 0,
      stdout: JSON.stringify({ state: "OPEN", headRefOid: "head", baseRefName: "main" }),
      stderr: "",
    };
  };
  const cache = new Map();
  await readPullRequestEvidence(ctx, first, "head", cache);
  await readPullRequestEvidence(ctx, second, "head", cache);
  expect(reads).toBe(1);
  await readPullRequestEvidence(ctx, first, "head", new Map());
  expect(reads).toBe(2);
});
