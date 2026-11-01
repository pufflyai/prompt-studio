import { expect, test } from "bun:test";
import { type ParameterValues, parameterValues } from "./parameters";

const controls = {
  opacity: { type: "number" as const, min: 0, max: 1, step: 0.1 },
  reducedMotion: { type: "boolean" as const },
  preset: {
    type: "select" as const,
    options: [
      { value: "instant", label: "Instant" },
      { value: "subtle", label: "Subtle" },
    ],
  },
};

test("declared frame parameters normalize numeric values and preserve other args", () => {
  const before = { label: "Example", opacity: 0.5, reducedMotion: false, preset: "subtle" };
  expect(parameterValues(controls, before, { opacity: 2, reducedMotion: true, preset: "instant" })).toEqual({
    ...before,
    opacity: 1,
    reducedMotion: true,
    preset: "instant",
  });
  expect(before.opacity).toBe(0.5);
});

test("parameter edits reject undeclared keys, non-finite numbers, and unsupported choices", () => {
  const changes: ParameterValues[] = [
    { opacity: Number.NaN },
    { opacity: "0.5" },
    { reducedMotion: 1 },
    { preset: "unknown" },
    { secret: "x" },
  ];
  for (const change of changes) {
    expect(() => parameterValues(controls, {}, change)).toThrow();
  }
});
