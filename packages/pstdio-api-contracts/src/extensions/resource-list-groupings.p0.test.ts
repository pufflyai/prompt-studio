import { expect, test } from "bun:test";
import { normalizeSubGroupings } from "../extension-kernel/resource-list-groupings";

test("sub-groupings keep their order, use each field once and never repeat the grouping", () => {
  expect(normalizeSubGroupings("region", ["channel", "region", "severity", "channel", "none"])).toEqual([
    "channel",
    "severity",
  ]);
});

test("there are no sub-groupings without a grouping", () => {
  expect(normalizeSubGroupings("none", ["channel"])).toEqual([]);
  expect(normalizeSubGroupings("region", undefined)).toEqual([]);
});
