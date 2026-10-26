import { expect } from "@playwright/test";

export const assertPagedCollectionBudget = (samples: { view: string; elapsedMs: number }[]) => {
  for (const sample of samples) {
    expect(Number.isFinite(sample.elapsedMs), `${sample.view}: measured readiness`).toBe(true);
    expect(sample.elapsedMs).toBeGreaterThan(0);
    // The product target is 1,000 ms. The user approved PS-902's temporary 1,250 ms ceiling for
    // this check on 2026-10-23 after CI measured 1,005-1,064 ms. Restore 1,000 ms when it passes again.
    expect(sample.elapsedMs, `${sample.view}: open and use 100 rows`).toBeLessThan(1250);
  }
};
