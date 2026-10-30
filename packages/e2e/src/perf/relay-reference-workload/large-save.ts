import assert from "node:assert/strict";
import { join } from "node:path";
import type { deploy } from "./deployment";
import { createDevice, type OwnerInput } from "./device";
import { inspectStorage } from "./inspect";
import { auditStorage } from "./storage-audit";
import type { observeTraffic } from "./traffic";

const closeDevices = async (devices: Awaited<ReturnType<typeof createDevice>>[]) => {
  const closed = await Promise.allSettled(devices.map((device) => device.close()));
  const failed = closed.filter((result) => result.status === "rejected");
  if (failed.length)
    throw new AggregateError(
      failed.map((result) => result.reason),
      "Device cleanup failed",
    );
};

/** Exercise the blob-backed frame path against the same real relay and object store. */
export const runLargeSave = async (input: {
  deployment: Awaited<ReturnType<typeof deploy>>;
  directory: string;
  traffic: ReturnType<typeof observeTraffic>;
  log: (message: string) => void;
  units: Map<string, OwnerInput>;
}) => {
  const { deployment, traffic, units } = input;
  const devices: Awaited<ReturnType<typeof createDevice>>[] = [];
  const unit: OwnerInput = {
    owner: { workbenchId: `${deployment.project}-large-save`, extensionId: "pstdio-tests.large-save" },
    secret: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url"),
    chunks: new Set(),
    frames: new Set(),
    files: new Set(),
  };
  const started = performance.now();
  try {
    for (const name of ["source", "follower", "fresh"]) {
      devices.push(
        await createDevice({
          name: `large-save-${name}`,
          account: `${deployment.project}-large-save`,
          directory: join(input.directory, "large-save"),
          deployment,
          traffic,
          units,
        }),
      );
    }
    const owners = await Promise.all(devices.map((device) => device.owner(unit)));
    const source = owners[0]!;
    traffic.phase("large-save/founding");
    await source.records.commit({ operationId: "seed", edits: [{ recordId: "seed", replace: { text: "seed" } }] });
    await source.sync.synchronize();
    const before = await inspectStorage(deployment.databaseUrl, deployment.s3);
    const state = before.rows.states.find((row) => row.documentId === source.documentId && row.replacedAt === null)!;
    const edits = Array.from({ length: 8 }, (_, index) => ({
      recordId: `large-${index}`,
      replace: { text: `${index}:${"x".repeat(150_000)}` },
    }));
    traffic.phase("large-save/oversized-group");
    await source.records.commit({ operationId: "oversized-group", edits });
    await source.sync.synchronize();
    traffic.phase("large-save/follower-download");
    for (const owner of owners.slice(1)) await owner.sync.synchronize();
    for (const owner of owners) {
      const records = await owner.records.list();
      assert.equal(records.length, 9);
      for (const edit of edits)
        assert.deepEqual(records.find((row) => row.recordId === edit.recordId)?.value, edit.replace);
      assert.deepEqual(await owner.sync.status(), { downloaded: true, pending: false, needsAttention: false });
    }
    await deployment.cleanup();
    const storage = await inspectStorage(deployment.databaseUrl, deployment.s3);
    const latest = storage.rows.states.find((row) => row.documentId === source.documentId && row.replacedAt === null)!;
    assert.notEqual(latest.stateId, state.stateId, "Large frame must trigger the default compaction rule");
    assert(unit.frames.size > 0, "Workload must store a blob-backed update frame");
    const audit = auditStorage(storage, units);
    assert(audit.passed, "Every physical object must be classified and within its storage bound");
    input.log(`large-save: ${unit.frames.size} blob-backed frame; three devices verified; physical audit passed`);
    return {
      name: "large-save",
      workload: { devices: 3, records: 9, groupedRecords: 8, textBytesPerGroupedRecord: 150_002 },
      elapsedMs: performance.now() - started,
      replacedStateId: state.stateId,
      latestStateId: latest.stateId,
      frameIds: [...unit.frames],
      storage,
      audit,
      passed: true,
    };
  } finally {
    await closeDevices(devices);
  }
};
