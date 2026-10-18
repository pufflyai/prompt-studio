import { expect, test } from "bun:test";
import { putAttempt } from "../data/attempt-storage";
import { putTicket, statusesCollection } from "../data/collections";
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
      ["gh", "pr", "view", "https://github.com/acme/tools/pull/2", "--json", "state,headRefOid,mergeCommit"],
    ]);
  } finally {
    await f.cleanup();
  }
});
