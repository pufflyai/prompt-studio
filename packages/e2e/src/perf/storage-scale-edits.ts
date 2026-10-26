import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import type { StorageRecord } from "@pstdio/sdk/extensions";
import { contract, editOperation, owners, workload } from "storage-scale-fixture";
import { type ScaleFixture, type ScaleRuntime, startScaleRuntime } from "./storage-scale-runtime";

export const samplePublicEdit = async (
  home: string,
  fixture: ScaleFixture,
  operation: string,
  temperature: string,
  sample: number,
  environment: Record<string, string> = {},
  background?: (runtime: ScaleRuntime) => Promise<unknown>,
  startRuntime: typeof startScaleRuntime = startScaleRuntime,
) => {
  const nonce = randomUUID();
  const edit = editOperation(fixture.kind, operation, nonce, workload(fixture.kind).rows);
  const owner = owners(workload(fixture.kind))[0];
  const input = { action: "commit", operationId: nonce, ...edit.change };
  const writer = await startRuntime(home, environment);
  const committed = await (async () => {
    try {
      if (temperature === "warm")
        await writer.execute(fixture.projectId, owner.id, "scale", { input: { action: "read", id: edit.recordId } });
      const started = performance.now();
      const running = background?.(writer);
      const acknowledgement = await writer.execute<{ outcome: { status: string }; durableAckMs: number }>(
        fixture.projectId,
        owner.id,
        "scale",
        { input },
      );
      assert.equal(acknowledgement.value.outcome.status, "saved-locally");
      // The direct/idle case kills immediately. A contention run first records its fixed
      // offered workload and drain, outside the foreground acknowledgement timer.
      const backgroundResult = await running;
      await writer.crash();
      const killedAfterMs = performance.now() - started;
      return { acknowledgementMs: acknowledgement.sdkRequestMs, killedAfterMs, acknowledgement, backgroundResult };
    } finally {
      await writer.stop();
    }
  })();
  const reopened = await startRuntime(home, environment);
  try {
    const { value } = await reopened.execute<StorageRecord>(fixture.projectId, owner.id, "scale", {
      input: { action: "record", id: edit.recordId },
    });
    assert.equal(value.deleted, operation === "delete");
    assert.deepEqual(value.value, edit.expected);
    const outcome = await reopened.execute<{ status: string }>(fixture.projectId, owner.id, "scale", {
      input: { action: "outcome", operationId: nonce },
    });
    assert.equal(outcome.value.status, "saved-locally");
    const page = await reopened.execute<{ total: number; matching: number; rows: { owner: number }[] }>(
      fixture.projectId,
      owner.id,
      "scale",
      {
        input: { action: "page", selection: "focus", count: owner.rows },
      },
    );
    assert.equal(page.value.total, owner.rows + Number(operation === "insert") - Number(operation === "delete"));
    assert.equal(
      page.value.matching,
      100 + Number(operation === "insert") - Number(operation === "delete" || operation === "indexed"),
    );
    assert(page.value.rows.every((row) => row.owner === 0));
    const retried = await reopened.execute(fixture.projectId, owner.id, "scale", { input });
    const repeated = await reopened.execute<StorageRecord>(fixture.projectId, owner.id, "scale", {
      input: { action: "record", id: edit.recordId },
    });
    assert.deepEqual(repeated.value.value, edit.expected);
    await reopened.execute(fixture.projectId, owner.id, "scale", {
      input: { action: "commit", operationId: `restore-${nonce}`, ...edit.restore },
    });
    return {
      operation,
      temperature,
      sample,
      startupMs: writer.startupMs,
      reopenedStartupMs: reopened.startupMs,
      runtimeControl: {
        writer: writer.controlEvidence,
        reopened: reopened.controlEvidence,
        counterBoundary: "startup and independent calibration; no foreground throttled-time delta",
      },
      ...committed,
      correctAfterKill: true,
      retryCorrect: true,
      retryMs: retried.sdkRequestMs,
      committedVisibleMs: null,
      passed: false,
      failures: [
        ...(committed.acknowledgement.sdkRequestMs >= contract.ceilingMs ? ["durable-sdk-latency"] : []),
        "committed-visible-boundary-unavailable",
        "index-work-unmeasured",
      ],
    };
  } finally {
    await reopened.stop();
  }
};
