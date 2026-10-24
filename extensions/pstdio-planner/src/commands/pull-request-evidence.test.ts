import { expect, test } from "bun:test";
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
  ctx.process.run = async ({ command }) => ({
    exitCode: 0,
    stdout: JSON.stringify({
      state: "OPEN",
      headRefOid: command.includes(task.reviewLinks![1]!.url) ? "new-head" : "old-head",
      statusCheckRollup: [{ conclusion: "SUCCESS" }],
    }),
    stderr: "",
  });
  expect(await readPullRequestEvidence(ctx, task, "new-head")).toMatchObject({ headRefOid: "new-head" });
  expect(await readPullRequestEvidence(ctx, task, "missing-head")).toMatchObject({
    error: "No linked PR matches the current submitted revision.",
  });
});
