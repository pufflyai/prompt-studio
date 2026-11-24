import { expect, test } from "bun:test";
import { reserveRecoveryAdmission } from "./recovery-budget";
import { createRunStorage } from "./run-storage-fixture";

test("recovery headroom applies across wall-minute boundaries and concurrent reservations", async () => {
  const store = createRunStorage();
  const kinds = [...Array(16).fill("cleanup"), ...Array(16).fill("log"), ...Array(8).fill("collector")] as const;
  const reservations = await Promise.all(kinds.map((kind) => reserveRecoveryAdmission(store, kind, 59_999)));
  expect(reservations.filter(Boolean)).toHaveLength(20);
  expect(await reserveRecoveryAdmission(store, "cleanup", 60_000)).toBe(false);
  expect(await reserveRecoveryAdmission(store, "log", 60_000)).toBe(false);
  expect(await reserveRecoveryAdmission(store, "collector", 60_000)).toBe(false);
  expect(await reserveRecoveryAdmission(store, "cleanup", 120_000)).toBe(true);
});
