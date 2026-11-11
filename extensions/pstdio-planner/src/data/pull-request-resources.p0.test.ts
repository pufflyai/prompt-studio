import { expect, test } from "bun:test";
import { fixture } from "../commands/auto-build.fixture";
import { ticketsCollection } from "./collections";
import { linkedPullRequests, migratePullRequestLinks, ticketReference } from "./pull-request-resources";

const legacy = (url: string, id: string, createdAt = "2026-10-10T00:00:00Z") => ({
  id,
  url,
  provider: "github" as const,
  kind: "pull_request" as const,
  externalId: "12",
  title: "Review",
  createdAt,
  updatedAt: createdAt,
});

test("migration preserves shared PR relationships, order and other review URLs, then removal stays removed", async () => {
  const { ctx, ticket } = await fixture();
  const first = await ticket("First");
  const second = await ticket("Second");
  const other = {
    ...legacy("https://example.com/review", "other"),
    provider: "unknown" as const,
    kind: "review" as const,
  };
  for (const task of [first, second]) {
    await ticketsCollection(ctx).update(task.id, {
      ...task,
      reviewLinks: [
        legacy("https://github.com/ACME/Tools/pull/12", "old"),
        legacy("https://github.com/acme/tools/pull/13", "replacement", "2026-10-11T00:00:00Z"),
        other,
      ],
    });
    await migratePullRequestLinks(ctx, task);
    expect((await ticketsCollection(ctx).get(task.id))?.reviewLinks).toEqual([other]);
  }
  const links = (await linkedPullRequests(ctx, first))!;
  expect(links.map(({ id }) => id).sort()).toEqual([
    "https://github.com/acme/tools/pull/12",
    "https://github.com/acme/tools/pull/13",
  ]);
  expect(links.find(({ id }) => id.endsWith("/13"))?.metadata?.plannerLinkedAt).toBe("2026-10-11T00:00:00Z");
  expect((await linkedPullRequests(ctx, second))!.map(({ id }) => id).sort()).toEqual(links.map(({ id }) => id).sort());
  await ctx.resources.removeAnchors(ticketReference(ctx, first.id), links);
  expect(await linkedPullRequests(ctx, first)).toEqual([]);
  expect(await linkedPullRequests(ctx, second)).toHaveLength(2);
});

test("an unavailable provider preserves legacy associations and migration resumes without duplicates", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Offline");
  const saved = { ...task, reviewLinks: [legacy("https://github.com/acme/tools/pull/12", "old")] };
  await ticketsCollection(ctx).update(task.id, saved);
  const execute = ctx.commands.execute;
  ctx.commands.execute = async () => ({ ok: false, reason: "disabled" }) as never;
  await migratePullRequestLinks(ctx, saved);
  expect((await ticketsCollection(ctx).get(task.id))?.reviewLinks).toEqual(saved.reviewLinks);
  expect(await linkedPullRequests(ctx, saved)).toBeNull();
  ctx.commands.execute = execute;
  await migratePullRequestLinks(ctx, saved);
  await migratePullRequestLinks(ctx, saved);
  expect((await ticketsCollection(ctx).get(task.id))?.reviewLinks).toEqual([]);
  expect(await linkedPullRequests(ctx, saved)).toHaveLength(1);
});

test("result links beyond the first relationship page remain available", async () => {
  const { ctx, ticket } = await fixture();
  const task = await ticket("Many relationships");
  await ctx.resources.addAnchors(
    ticketReference(ctx, task.id),
    Array.from({ length: 105 }, (_, index) => ({
      type: "pull-request",
      extensionId: "pstdio.github",
      id: `https://github.com/acme/tools/pull/${index + 1}`,
      role: "result" as const,
    })),
  );
  expect(await linkedPullRequests(ctx, task)).toHaveLength(105);
});

test("unfinished legacy migration cannot turn a PR-backed done dependency into a manual delivery", async () => {
  const { readDependencyDeliveries } = await import("./dependency-deliveries");
  const { ctx, ticket } = await fixture();
  const parent = {
    ...(await ticket("Parent")),
    statusId: "done",
    reviewLinks: [legacy("https://github.com/acme/tools/pull/12", "old")],
  };
  const child = await ticket("Child", [parent.id]);
  await ticketsCollection(ctx).update(parent.id, parent);
  ctx.commands.execute = async () => ({ ok: false, reason: "disabled" }) as never;
  expect(
    (await readDependencyDeliveries(ctx, child, [parent, child], new Set(["done"]), "/repo")).get(parent.id),
  ).toEqual({ headSha: null, mergeSha: null });
});
