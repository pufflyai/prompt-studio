import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { quotaAvailability } from "./quota-availability";

const harnessId = "example.native.harness.agent";
const snapshot = (limits: unknown[], enabled = true) =>
  makeCommandContext({
    storage: createMemoryStorage(),
    params: {},
    overrides: {
      commands: {
        execute: async (ref) => {
          expect(ref).toMatchObject({ extensionId: "example.native", id: "quotas" });
          return {
            ok: true,
            status: "success",
            value: { status: "available", limits, restartAfterQuotaReset: enabled },
          } as never;
        },
      },
    },
  });
test("quota availability waits for every exhausted window and preserves opt-in", async () => {
  const early = new Date(Date.now() + 60_000).toISOString();
  const later = new Date(Date.now() + 120_000).toISOString();
  const ctx = snapshot([
    { remainingPercent: 0, resetsAt: early },
    { remainingPercent: 25 },
    { remainingPercent: 0, resetsAt: later },
  ]);
  expect(await quotaAvailability.run(ctx, { harnessId })).toMatchObject({
    known: true,
    limited: true,
    resetsAt: later,
    restartAfterQuotaReset: true,
  });
});
test("an exhausted window without a known reset cannot promise a restart", async () => {
  const ctx = snapshot([
    { remainingPercent: 0 },
    { remainingPercent: 0, resetsAt: new Date(Date.now() + 60_000).toISOString() },
  ]);
  expect(await quotaAvailability.run(ctx, { harnessId })).toMatchObject({
    known: true,
    limited: true,
    resetsAt: undefined,
  });
});
test("available capacity and disabled restart remain distinct", async () => {
  const ctx = snapshot([{ remainingPercent: 50 }], false);
  expect(await quotaAvailability.run(ctx, { harnessId })).toMatchObject({
    known: true,
    limited: false,
    restartAfterQuotaReset: false,
  });
});

test("an earlier elapsed exhausted meter does not hide a later known reset", async () => {
  const later = new Date(Date.now() + 120_000).toISOString();
  const ctx = snapshot([
    { remainingPercent: 0, resetsAt: new Date(Date.now() - 1).toISOString() },
    { remainingPercent: 0, resetsAt: later },
  ]);
  expect(await quotaAvailability.run(ctx, { harnessId })).toMatchObject({ limited: true, resetsAt: later });
});
