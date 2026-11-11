import { expect, test } from "bun:test";
import { pollQuotas } from "./quota-polling";

test("quotas refresh automatically after completion, without overlapping, and stop on cleanup", async () => {
  const first = Promise.withResolvers<never[]>();
  const second = Promise.withResolvers<never[]>();
  const nextRead = Promise.withResolvers<void>();
  let reads = 0;
  let updates = 0;
  const stop = pollQuotas({
    intervalMs: 0,
    read: () => {
      reads++;
      if (reads === 1) return first.promise;
      nextRead.resolve();
      return second.promise;
    },
    onData: () => {
      updates++;
    },
    onError: () => {
      throw new Error("Unexpected quota failure");
    },
  });
  try {
    await Bun.sleep(5);
    expect(reads).toBe(1);
    first.resolve([]);
    await nextRead.promise;
    expect(updates).toBe(1);
    stop();
    second.resolve([]);
    await Bun.sleep(0);
    expect(reads).toBe(2);
    expect(updates).toBe(1);
  } finally {
    stop();
    first.resolve([]);
    second.resolve([]);
  }
});

test("an automatic refresh recovers after a quota read fails", async () => {
  const recovered = Promise.withResolvers<void>();
  let reads = 0;
  let errors = 0;
  const stop = pollQuotas({
    intervalMs: 0,
    read: async () => {
      if (++reads === 1) throw new Error("Offline");
      return [];
    },
    onData: () => recovered.resolve(),
    onError: () => {
      errors++;
    },
  });
  try {
    await recovered.promise;
    expect(errors).toBe(1);
    expect(reads).toBe(2);
  } finally {
    stop();
  }
});
