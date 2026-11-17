import { expect, test } from "bun:test";
import { changedHarnessParams } from "./harness-settings";

test("generic forms remove reset overrides while native sessions explicitly replace persisted settings", () => {
  const defaults = { thinking: "low" };
  expect(changedHarnessParams({}, defaults)).toEqual({});
  expect(changedHarnessParams({}, defaults, "resolved")).toEqual({ thinking: "low" });
  const persisted = { thinking: "high" };
  const followup = { ...persisted, ...changedHarnessParams({}, defaults, "resolved") };
  expect(followup.thinking).toBe("low");
  expect(changedHarnessParams({ thinking: "high" }, defaults)).toEqual({ thinking: "high" });
});
