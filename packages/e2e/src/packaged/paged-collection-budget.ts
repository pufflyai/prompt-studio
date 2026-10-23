import { expect } from "@playwright/test";

export const assertPagedCollectionBudget = (samples: { view: string; elapsedMs: number }[]) => {
  for (const sample of samples) {
    expect(Number.isFinite(sample.elapsedMs), `${sample.view}: measured readiness`).toBe(true);
    expect(sample.elapsedMs).toBeGreaterThan(0);
    expect(sample.elapsedMs, `${sample.view}: open and use 100 rows`).toBeLessThan(1000);
  }
};
