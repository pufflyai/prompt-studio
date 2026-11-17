import { expect, test } from "bun:test";
import { createMemoryActivity, createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import type { AttemptRecord, AttemptRevision } from "../data/attempt-types";
import { readReviewEvidence, validateImplementationEvidence } from "./activity-evidence";

test("Planner accepts exact Activity evidence without Reports and rejects a foreign session or revision", async () => {
  const activity = createMemoryActivity();
  const ctx = makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    projectId: "project",
    overrides: {
      extensionId: "pstdio.pstdio-planner",
      activity,
      commands: {
        execute: async () => {
          throw new Error("Reports must not be required");
        },
      },
    },
  });
  const resource = { projectId: ctx.projectId, extensionId: ctx.extensionId, type: "ticket", id: "ticket" };
  const attempt = { ticketId: "ticket", workspaceId: "workspace" } as AttemptRecord;
  const context = {
    workspaceId: "workspace",
    sessionId: "implementation",
    headSha: "a".repeat(40),
    baseSha: "b".repeat(40),
    revision: 1,
  };
  const implementation = await activity.publish(resource, {
    key: "implementation",
    kind: "implementation",
    body: "Implemented",
    revision: context,
  });
  const ids = { changeRequestActivityId: implementation.id };
  await validateImplementationEvidence(ctx, attempt, ids, context);
  await expect(validateImplementationEvidence(ctx, attempt, ids, { ...context, sessionId: "another" })).rejects.toThrow(
    "session",
  );
  const review = await activity.publish(resource, {
    key: "review",
    kind: "review",
    body: "Reviewed",
    revision: { ...context, sessionId: "reviewer" },
    implementationId: implementation.id,
    verdict: "passed",
    findings: [],
  });
  const revision = {
    ...context,
    changeRequestReportId: null,
    changeRequestActivityId: implementation.id,
  } as unknown as AttemptRevision;
  expect(
    await readReviewEvidence(ctx, attempt, revision, "reviewer", { reviewActivityId: review.id, verdict: "passed" }),
  ).toEqual([]);
  await expect(
    readReviewEvidence(ctx, attempt, { ...revision, headSha: "c".repeat(40) }, "reviewer", {
      reviewActivityId: review.id,
      verdict: "passed",
    }),
  ).rejects.toThrow("revision");
  await expect(
    readReviewEvidence(ctx, attempt, revision, "reviewer", {
      reviewActivityId: review.id,
      verdict: "passed",
      threads: [{ severity: "suggestion", body: "Not in the outcome" }],
    }),
  ).rejects.toThrow("canonical");
});
