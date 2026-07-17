import { describe, expect, test } from "bun:test";
import type { FrameSlot } from "../../core";
import { isFixedSlotSize, resolveSlotSize } from "./frame-size";

const slot = {
  kind: "slot",
  id: "secondary",
  owner: "resource",
  role: "panels",
  size: { defaultPx: 240, minPx: 128, maxPx: 420 },
} satisfies FrameSlot;

describe("resolveSlotSize", () => {
  test("falls back each contributed size field independently", () => {
    expect(resolveSlotSize(slot, { defaultPx: 300, minPx: 120 })).toEqual({
      defaultPx: 300,
      minPx: 120,
      maxPx: 420,
    });
  });

  test("keeps optional fields absent when neither source declares them", () => {
    expect(resolveSlotSize({ ...slot, size: undefined }, undefined)).toEqual({});
  });

  test("distinguishes fixed shell sizes from resizable panel sizes", () => {
    expect(isFixedSlotSize({ defaultPx: 40, minPx: 40, maxPx: 40 })).toBe(true);
    expect(isFixedSlotSize({ defaultPx: 240, minPx: 128, maxPx: 420 })).toBe(false);
  });
});
