import { expect, test } from "bun:test";
import { putAttempt } from "../data/attempt-storage";
import { statusesCollection } from "../data/collections";
import { putTicket } from "../data/ticket-context.fixture";
import { loadAttemptReadiness } from "./attempt-readiness";
import { stackSubmissionFixture } from "./stack-submission.fixture";

test.each([
  "merged",
  "open",
  "unavailable",
  "different-target",
])("replacement PR delivery uses verified target history: %s", async (scenario) => {
  const f = await stackSubmissionFixture();
  try {
    const parent = await f.ticket("Parent");
    await f.ticket("Child", [parent.id]);
    const done = (await statusesCollection(f.storage).list()).find(({ name }) => name === "Done")!;
    await putTicket(f.storage, {
      ...parent,
      archived: true,
      statusId: done.id,
      reviewLinks: ["older-stack", "replacement"].map((id, index) => ({
        id,
        provider: "github",
        kind: "pull_request",
        externalId: String(index + 1),
        title: null,
        url: `https://github.com/acme/tools/pull/${index + 1}`,
        createdAt: `2026-10-1${index}T00:00:00Z`,
        updatedAt: "2026-10-15T00:00:00Z",
      })),
    });
    await putAttempt(f.storage, { ...f.attempt, ticketId: parent.id, workspaceId: "deleted" });
    await f.git("checkout", "-b", "recovery");
    const head = await f.commit("replacement.txt");
    await f.git("checkout", "main");
    await f.git("merge", "--squash", "recovery");
    await f.git("commit", "-m", "Deliver replacement");
    const merge = await f.git("rev-parse", "HEAD");
    const commands: string[][] = [];
    const run = f.ctx.process.run;
    f.ctx.process.run = async (input) => {
      if (input.command[0] !== "gh") return run(input);
      commands.push(input.command);
      return {
        exitCode: scenario === "unavailable" ? 1 : 0,
        stderr: "",
        stdout: JSON.stringify({
          state: scenario === "open" ? "OPEN" : "MERGED",
          baseRefName: "main",
          headRefOid: head,
          mergeCommit: { oid: merge },
        }),
      };
    };
    const result = await loadAttemptReadiness(f.ctx, "Child", {
      base: scenario === "different-target" ? f.base : "main",
    });
    expect(result.readiness).toMatchObject(
      scenario === "merged"
        ? { decision: "ready", mode: "main" }
        : { decision: "wait", reason: "dependency-not-ready" },
    );
    expect(commands).toEqual([
      [
        "gh",
        "pr",
        "view",
        "https://github.com/acme/tools/pull/2",
        "--json",
        "headRefOid,baseRefName,mergeable,statusCheckRollup,state,mergeCommit",
      ],
    ]);
  } finally {
    await f.cleanup();
  }
});

test.each([
  "open replacement",
  "unavailable replacement",
  "merged replacement",
  "ambiguous revision",
  "incompatible targets",
])("generic result links follow submitted evidence without URL ordering: %s", async (scenario) => {
  const { fixture } = await import("./auto-build.fixture");
  const { runAttemptCommand } = await import("./run-attempt");
  const { readDependencyDeliveries } = await import("../data/dependency-deliveries");
  const { ticketReference } = await import("../data/pull-request-resources");
  const f = await fixture();
  const parent = { ...(await f.ticket("Parent")), statusId: "done" };
  const child = await f.ticket("Child", [parent.id]);
  const { variant } = await runAttemptCommand.run(f.ctx, { ticket: parent.id });
  if (scenario !== "ambiguous revision")
    await putAttempt(f.storage, {
      ...variant,
      revisions: [
        {
          revision: 1,
          baseSha: "base",
          headSha: "new-head",
          changeRequestReportId: "report",
          submittedAt: parent.createdAt,
          submittedBy: { type: "agent", id: "owner", displayName: "Owner" },
          reviews: [],
        },
      ],
    });
  await f.ctx.resources.addAnchors(
    ticketReference(f.ctx, parent.id),
    [9, 10].map((number) => ({
      type: "pull-request",
      extensionId: "pstdio.github",
      id: `https://github.com/acme/tools/pull/${number}`,
      role: "result" as const,
    })),
  );
  f.ctx.process.run = async ({ command }) => {
    const replacement = command.includes("https://github.com/acme/tools/pull/10");
    const merge = replacement ? "new-merge" : "old-merge";
    return {
      exitCode: replacement && scenario === "unavailable replacement" ? 1 : 0,
      stderr: "offline",
      stdout: JSON.stringify({
        state: replacement && scenario === "open replacement" ? "OPEN" : "MERGED",
        headRefOid: replacement || scenario === "incompatible targets" ? "new-head" : "old-head",
        baseRefName: !replacement && scenario === "incompatible targets" ? "other" : "main",
        mergeCommit: {
          oid: scenario === "incompatible targets" ? "same-merge" : merge,
        },
      }),
    };
  };
  const deliveries = await readDependencyDeliveries(f.ctx, child, [parent, child], new Set(["done"]), "/repo");
  expect(deliveries.get(parent.id)).toEqual(
    scenario === "unavailable replacement" || scenario === "ambiguous revision"
      ? { headSha: null, mergeSha: null }
      : { headSha: "new-head", mergeSha: scenario === "merged replacement" ? "new-merge" : null },
  );
});
