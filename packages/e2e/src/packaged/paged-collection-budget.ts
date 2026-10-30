import { expect } from "@playwright/test";
import { collectionBudget, findBudgetFailures } from "pstdio-benchmarks";
import { recordMeasurement } from "pstdio-benchmarks/writer";

export const assertPagedCollectionBudget = (samples: { view: string; elapsedMs: number }[]) => {
  for (const sample of samples) {
    recordMeasurement({
      metric: sample.view,
      label: `Open paged ${sample.view}`,
      unit: "ms",
      value: sample.elapsedMs,
      budget: collectionBudget.value,
    });
    expect(Number.isFinite(sample.elapsedMs), `${sample.view}: measured readiness`).toBe(true);
    expect(sample.elapsedMs).toBeGreaterThan(0);
    // The product target is 1,000 ms. The user approved PS-902's temporary 1,250 ms ceiling for
    // this check on 2026-10-23 after CI measured 1,005-1,064 ms. Restore 1,000 ms when it passes again.
    expect(
      findBudgetFailures([
        {
          name: `${sample.view}: open and use 100 rows`,
          unit: "ms",
          value: sample.elapsedMs,
          budget: collectionBudget.value,
        },
      ]),
    ).toEqual([]);
  }
};
