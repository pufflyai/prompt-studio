import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  assess,
  contract,
  createRow,
  owners,
  type Profile,
  pageRows,
  type Workload,
  workload,
} from "storage-scale-fixture";
import { measureScaleNavigation } from "./storage-scale-browser";
import { startScaleRuntime } from "./storage-scale-runtime";

export const sampleScaleRuntime = async (
  home: string,
  root: string,
  kind: Workload,
  profile: Profile,
  emit: (data: object) => void,
) => {
  const fixture = JSON.parse(readFileSync(join(home, "scale-project.json"), "utf8"));
  if (fixture.kind !== kind) throw new Error("Fixture kind mismatch");
  for (let sample = 0; sample < contract.samples; sample++) {
    const runtime = await startScaleRuntime(home);
    try {
      for (const temperature of ["cold", "warm"]) {
        const burstStart = performance.now();
        const replies = await Promise.all(
          owners(workload(kind)).map(async (owner) => {
            const { value, sdkRequestMs } = await runtime.execute<{
              rows: { id: string }[];
              scanned: number;
              materialized: number;
            }>(fixture.projectId, owner.id, "scale", {
              input: { action: "page", selection: "focus", count: owner.rows, planner: owner.index === 9 },
            });
            const expected = pageRows(workload(kind), owner.index, "focus", 0).map((row) => row.id);
            const correct = JSON.stringify(value.rows.map((row) => row.id)) === JSON.stringify(expected);
            return {
              owner: owner.id,
              sdkRequestMs,
              ...value,
              ...assess({
                durationMs: sdkRequestMs,
                correct,
                scanned: value.scanned,
                materialized: value.materialized,
                returned: value.rows.length,
                fullOwnerLoads: temperature === "cold" ? 1 : 0,
                durable: true,
              }),
            };
          }),
        );
        emit({ phase: "all-owner-burst", sample, temperature, durationMs: performance.now() - burstStart, replies });
      }
    } finally {
      await runtime.stop();
    }
    // A direct first API write uses its own fresh runtime, so the burst cannot hide hydration.
    const writer = await startScaleRuntime(home);
    try {
      const row = createRow(kind, 0, 37, 3);
      const operationId = `sdk-first-${sample}`;
      const saved = await writer.execute<{ durableAckMs: number }>(
        fixture.projectId,
        owners(workload(kind))[0].id,
        "scale",
        { input: { action: "commit", operationId, rows: [{ ...row, title: operationId }] } },
      );
      emit({ phase: "direct-sdk-first-write", sample, ...saved });
      await writer.execute(fixture.projectId, owners(workload(kind))[0].id, "scale", {
        input: { action: "commit", operationId: `reset-${sample}`, rows: [row] },
      });
    } finally {
      await writer.stop();
    }
    const browserRuntime = await startScaleRuntime(home);
    try {
      const navigation = await measureScaleNavigation(browserRuntime, fixture, profile, "board");
      writeFileSync(join(root, `navigation-${sample}.png`), navigation.screenshot);
      emit({ phase: "navigation", sample, profile, ...navigation, screenshot: `navigation-${sample}.png` });
    } finally {
      await browserRuntime.stop();
    }
  }
};
