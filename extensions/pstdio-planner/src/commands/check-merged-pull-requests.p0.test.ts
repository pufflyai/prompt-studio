import { expect, test } from "bun:test";
import { attemptEventsCollection, putAttempt } from "../data/attempt-storage";
import { ticketsCollection } from "../data/collections";
import { ticketReference } from "../data/pull-request-resources";
import { fixture } from "./auto-build.fixture";
import { checkMergedPullRequestsCommand } from "./check-merged-pull-requests";
import { runAttemptCommand } from "./run-attempt";

const setup = async () => {
  const { ctx, storage, ticket } = await fixture();
  const task = await ticket("PR delivery");
  const { variant } = await runAttemptCommand.run(ctx, { ticket: task.id });
  await putAttempt(storage, {
    ...variant,
    revisions: [
      {
        revision: 1,
        baseSha: "main-sha",
        headSha: "head",
        changeRequestReportId: "report",
        submittedAt: task.createdAt,
        submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
        reviews: [],
      },
    ],
  });
  await ctx.settings.set("implementation.defaultTargetBranch", "origin/main");
  let reads = 0;
  let evidence = { state: "MERGED", baseRefName: "main", headRefOid: "head", mergeCommit: { oid: "merge" } };
  ctx.process.run = async ({ command }) => {
    if (command[0] === "gh") {
      reads++;
      if (command.includes("list"))
        return { exitCode: 0, stdout: '[{"url":"https://github.com/acme/tools/pull/12"}]', stderr: "" };
      return { exitCode: 0, stdout: JSON.stringify(evidence), stderr: "" };
    }
    return {
      exitCode: 0,
      stdout: command.includes("get-url") ? "git@github.com:acme/tools.git" : "origin",
      stderr: "",
    };
  };
  const link = (role: "context" | "result", id = "https://github.com/acme/tools/pull/12", ticketId = task.id) =>
    ctx.resources.addAnchors(ticketReference(ctx, ticketId), [
      { type: "pull-request", extensionId: "pstdio.github", id, role },
    ]);
  return {
    ctx,
    storage,
    task,
    variant,
    link,
    reads: () => reads,
    change: (patch: Partial<typeof evidence>) => {
      evidence = { ...evidence, ...patch };
    },
  };
};

test.each([
  "matching",
  "context",
  "changed head",
  "other target",
  "other repository",
  "unavailable",
  "no submission",
])("PR completion requires submitted delivery evidence: %s", async (scenario) => {
  const f = await setup();
  await f.link(
    scenario === "context" ? "context" : "result",
    scenario === "other repository" ? "https://github.com/acme/other/pull/12" : undefined,
  );
  if (scenario === "changed head") f.change({ headRefOid: "new-head" });
  if (scenario === "other target") f.change({ baseRefName: "release" });
  if (scenario === "unavailable") f.ctx.commands.execute = async () => ({ ok: false, reason: "unavailable" }) as never;
  if (scenario === "no submission") await putAttempt(f.storage, { ...f.variant, revisions: [] });
  await checkMergedPullRequestsCommand.run(f.ctx, {});
  expect((await ticketsCollection(f.ctx).get(f.task.id))?.statusId).toBe(
    scenario === "matching" ? "done" : f.task.statusId,
  );
  expect(
    (await attemptEventsCollection(f.storage).list()).filter((event) => event.type === "attempt_merged"),
  ).toHaveLength(scenario === "matching" ? 1 : 0);
});

test("two tickets sharing a PR use one fresh lookup", async () => {
  const f = await setup();
  await f.link("result");
  const task = await ticketsCollection(f.ctx).get(f.task.id);
  const identity = await f.ctx.resources.allocate({ kind: "ticket" });
  await ticketsCollection(f.ctx).put(identity.id, { ...task!, id: identity.id });
  await f.link("result", undefined, identity.id);
  await checkMergedPullRequestsCommand.run(f.ctx, {});
  expect(f.reads()).toBe(1);
});

test("submitted workspace branch discovery remains GitHub-owned", async () => {
  const f = await setup();
  f.ctx.workspaces.list = async () => [{ id: f.variant.workspaceId, branch: "feature/work" }] as never;
  await checkMergedPullRequestsCommand.run(f.ctx, {});
  expect((await ticketsCollection(f.ctx).get(f.task.id))?.statusId).toBe("done");
  expect(f.reads()).toBe(2);
});
