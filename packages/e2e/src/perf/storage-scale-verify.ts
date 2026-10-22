import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { owners, type Workload, workload } from "storage-scale-fixture";
import { type ScaleFixture, startScaleRuntime } from "./storage-scale-runtime";

interface StoredShape {
  count: number;
  historyCounts: Record<string, number>;
  minBytes: number;
  medianBytes: number;
  maxBytes: number;
  tail16KiB: number;
}

// Full reads happen only in preparation. Close this process before any cold sample.
export const verifyScaleFixture = async (home: string, kind: Workload) => {
  const fixture = JSON.parse(readFileSync(join(home, "scale-project.json"), "utf8")) as ScaleFixture;
  assert.equal(fixture.kind, kind);
  const runtime = await startScaleRuntime(home);
  const stored = [];
  try {
    for (const owner of owners(workload(kind))) {
      const { value } = await runtime.execute<StoredShape>(fixture.projectId, owner.id, "scale", {
        input: { action: "stats", planner: owner.index === 9 },
      });
      assert.equal(value.count, owner.rows);
      assert.deepEqual(value.historyCounts, { "3": owner.rows });
      if (kind === "rich") {
        assert(value.medianBytes >= 2_048);
        assert(value.tail16KiB >= owner.rows / 20);
      } else if (owner.index === 0) {
        assert(value.minBytes >= 256 && value.maxBytes <= 1_024);
        assert(value.medianBytes >= 512);
      }
      stored.push({ owner: owner.id, ...value });
    }
    return { fixture, stored, complete: true, ownerStatePreloaded: true, runtimeClosedBeforeMeasurement: true };
  } finally {
    await runtime.stop();
  }
};
