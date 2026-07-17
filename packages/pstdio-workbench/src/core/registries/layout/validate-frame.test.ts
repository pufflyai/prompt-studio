import { describe, expect, test } from "bun:test";
import { classicFrame } from "./classic-frame";
import type { Frame, FrameNode, FrameSlot, SlotPresentation } from "./frame-types";
import { validateFrame } from "./validate-frame";

const slot = (id: string, presentations?: SlotPresentation[]): FrameSlot => ({
  kind: "slot",
  id,
  owner: "project",
  role: "panels",
  presentations,
});

const frame = (root: FrameNode, primary = "main"): Frame => ({
  id: "test-frame",
  root,
  primary,
  slots: {},
});

const split = (...children: FrameNode[]): FrameNode => ({
  kind: "split",
  id: "root",
  direction: "row",
  children,
});

const hasError = (errors: string[], fragment: string) => errors.some((error) => error.includes(fragment));

describe("validateFrame", () => {
  test("accepts the classic frame", () => {
    expect(validateFrame(classicFrame)).toEqual([]);
  });

  test("rejects duplicate slot ids", () => {
    expect(hasError(validateFrame(frame(split(slot("main"), slot("main")))), "duplicate slot")).toBe(true);
  });

  test("rejects a missing primary slot", () => {
    expect(hasError(validateFrame(frame(split(slot("other")))), "primary")).toBe(true);
  });

  test("rejects an empty split", () => {
    expect(hasError(validateFrame(frame(split())), "empty split")).toBe(true);
  });

  test("rejects a shared secondary and attached slot", () => {
    const input = {
      ...frame(split(slot("main"), slot("side"))),
      secondary: { slot: "side", persistence: "derived", candidates: "scoped" },
      attached: { slot: "side", persistence: "detached", candidates: "scoped" },
    } satisfies Frame;

    expect(hasError(validateFrame(input), "secondary and attached")).toBe(true);
  });

  test.each([
    ["empty", []],
    ["duplicate", ["docked", "docked"]],
    ["hidden-only", ["hidden"]],
    ["unknown", ["sideways"]],
  ])("rejects %s presentations", (_case, presentations) => {
    const invalidPresentations = presentations as SlotPresentation[];
    expect(hasError(validateFrame(frame(split(slot("main", invalidPresentations)))), "presentations")).toBe(true);
  });

  test("rejects missing and self-referential companions", () => {
    const missing = { ...slot("main"), companionOf: "missing" };
    const self = { ...slot("main"), companionOf: "main" };

    expect(hasError(validateFrame(frame(split(missing))), "companion")).toBe(true);
    expect(hasError(validateFrame(frame(split(self))), "companion")).toBe(true);
  });
});
