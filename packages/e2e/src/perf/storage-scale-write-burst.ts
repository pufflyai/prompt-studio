import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { contract, createRow, owners, workload } from "storage-scale-fixture";
import { plannerValue } from "./storage-scale-extension";
import { type ScaleFixture, type ScaleRuntime, startScaleRuntime } from "./storage-scale-runtime";

export const sampleWriteBurst = async (
  home: string,
  fixture: ScaleFixture,
  temperature: string,
  environment: Record<string, string>,
  background?: (runtime: ScaleRuntime) => Promise<unknown>,
) => {
  const changes = owners(workload(fixture.kind)).map((owner) => {
    const base = createRow(fixture.kind, owner.index, 37, 3);
    const operationId = randomUUID();
    const expected = { ...base, title: `Concurrent ${operationId}` };
    return {
      owner,
      base,
      expected,
      input: { action: "commit", operationId, rows: [expected], planner: owner.index === 9, count: owner.rows },
    };
  });
  const runtime = await startScaleRuntime(home, environment);
  const measured = await (async () => {
    try {
      if (temperature === "warm")
        await Promise.all(
          changes.map(({ owner, base }) =>
            runtime.execute(fixture.projectId, owner.id, "scale", {
              input: { action: "read", id: base.id, planner: owner.index === 9 },
            }),
          ),
        );
      const running = background?.(runtime);
      const start = performance.now();
      const replies = await Promise.all(
        changes.map(async ({ owner, input }) => {
          const reply = await runtime.execute<{ outcome: { status: string } }>(fixture.projectId, owner.id, "scale", {
            input,
          });
          assert.equal(reply.value.outcome.status, "saved-locally");
          return { owner: owner.id, acknowledgementMs: reply.sdkRequestMs };
        }),
      );
      const durationMs = performance.now() - start;
      const backgroundResult = await running;
      await runtime.crash();
      return { durationMs, replies, backgroundResult };
    } finally {
      await runtime.stop();
    }
  })();
  const reopened = await startScaleRuntime(home, environment);
  try {
    for (const { owner, base, expected, input } of changes) {
      const saved = await reopened.execute(fixture.projectId, owner.id, "scale", {
        input: { action: "read", id: base.id, planner: owner.index === 9 },
      });
      assert.deepEqual(saved.value, owner.index === 9 ? plannerValue(expected, owner.rows) : expected);
      if (owner.index !== 9) {
        const retry = await reopened.execute<{ outcome: { status: string } }>(fixture.projectId, owner.id, "scale", {
          input,
        });
        assert.equal(retry.value.outcome.status, "saved-locally");
        const repeated = await reopened.execute(fixture.projectId, owner.id, "scale", {
          input: { action: "read", id: base.id },
        });
        assert.deepEqual(repeated.value, expected);
      }
      await reopened.execute(fixture.projectId, owner.id, "scale", {
        input: { ...input, operationId: `restore-${input.operationId}`, rows: [base] },
      });
    }
    return {
      ...measured,
      correctAfterKill: true,
      startupMs: runtime.startupMs,
      reopenedStartupMs: reopened.startupMs,
      retryVerifiedOwners: 9,
      plannerRetryVerified: false,
      runtimeControl: {
        writer: runtime.controlEvidence,
        reopened: reopened.controlEvidence,
        counterBoundary: "startup and independent calibration; no foreground throttled-time delta",
      },
      fairness: {
        fastestMs: Math.min(...measured.replies.map((row) => row.acknowledgementMs)),
        slowestMs: Math.max(...measured.replies.map((row) => row.acknowledgementMs)),
      },
      passed: false,
      failures: [
        ...(measured.replies.some((row) => row.acknowledgementMs >= contract.ceilingMs) ? ["durable-sdk-latency"] : []),
        "planner-collection-retry-identity-unavailable",
        "index-work-unmeasured",
        "committed-visible-boundary-unavailable",
      ],
    };
  } finally {
    await reopened.stop();
  }
};
