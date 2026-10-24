import { expect, test } from "bun:test";
import { planRecoverySlots } from "./recovery-slots";

const now = new Date("2026-10-24T12:00:00Z");
const at = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3_600_000).toISOString();

test("a new project captures the hour, 12-hour and day points together", () => {
  expect(planRecoverySlots({ existing: [], now, room: 3 })).toEqual({ write: [1, 12, 24], drop: [] });
});

test("each point is replaced only after its period has passed", () => {
  const existing = [
    { hours: 1, capturedAt: at(1) },
    { hours: 12, capturedAt: at(11) },
    { hours: 24, capturedAt: at(24) },
  ];
  expect(planRecoverySlots({ existing, now, room: 100 })).toEqual({ write: [1, 24], drop: [] });
});

test("when the disk cannot hold every due point, only the 12-hour point is kept", () => {
  expect(planRecoverySlots({ existing: [], now, room: 2 })).toEqual({ write: [12], drop: [] });
  const existing = [
    { hours: 1, capturedAt: at(2) },
    { hours: 12, capturedAt: at(2) },
    { hours: 24, capturedAt: at(2) },
  ];
  expect(planRecoverySlots({ existing, now, room: 0 })).toEqual({ write: [], drop: [1, 24] });
});
