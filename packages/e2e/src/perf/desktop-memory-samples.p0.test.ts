import { expect, test } from "bun:test";
import type { KernelProcessReading } from "pstdio-diagnostics";
import { ownedProcessTree } from "./desktop-memory-samples";

test("remembered process identity is checked before adopting its descendants", async () => {
  const identities = new Map([
    [10, "original-child"],
    [20, "retained-child"],
  ]);
  const reading = (identity: string) =>
    ({
      processStartId: identity,
      cpuTimeMs: 0,
      residentBytes: 1,
      peakResidentBytes: null,
      physicalFootprintBytes: 1,
      peakPhysicalFootprintBytes: null,
      privateCommittedBytes: null,
    }) satisfies KernelProcessReading;
  const { owned, reused, priorReadings } = await ownedProcessTree(
    [
      [1, 0],
      [2, 1],
      [10, 99],
      [11, 10],
      [20, 99],
      [21, 20],
    ],
    [1],
    identities,
    async (pid) => reading(pid === 10 ? "unrelated-reused-pid" : "retained-child"),
  );
  expect([...owned].sort((a, b) => a - b)).toEqual([1, 2, 20, 21]);
  expect([...reused]).toEqual([10]);
  expect(identities.get(10)).toBe("original-child");
  expect(priorReadings.get(20)?.processStartId).toBe("retained-child");
  const again = await ownedProcessTree(
    [
      [10, 99],
      [11, 10],
    ],
    [10],
    identities,
    async () => reading("unrelated-reused-pid"),
  );
  expect([...again.owned]).toEqual([]);
  expect([...again.reused]).toEqual([10]);
});
