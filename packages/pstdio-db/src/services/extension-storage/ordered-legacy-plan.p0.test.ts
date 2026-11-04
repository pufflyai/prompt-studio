import { expect, test } from "bun:test";
import { encodeRecordFrame } from "pstdio-sync/relay";
import { decodeLegacyPendingFrame, LegacyPendingMask } from "./ordered-legacy-plan";

test("reverse legacy planning omits only later-covered fields while retaining each frame's other intent", () => {
  const mask = new LegacyPendingMask();
  mask.select("card", { lifecycle: undefined, paths: [["value", "body"]] });
  const early = mask.select("card", {
    lifecycle: undefined,
    paths: [
      ["value", "title"],
      ["value", "body"],
    ],
  });
  expect(early.effective).toEqual([{ path: ["value", "title"], holes: [] }]);
  expect(early.dirty).toEqual([
    ["value", "title"],
    ["value", "body"],
  ]);
});

test("later descendants become holes inside an earlier whole object, and older descendants are then covered", () => {
  const mask = new LegacyPendingMask();
  mask.select("card", { lifecycle: undefined, paths: [["value", "branch", "large"]] });
  expect(mask.select("card", { lifecycle: undefined, paths: [["value", "branch"]] }).effective).toEqual([
    { path: ["value", "branch"], holes: [["large"]] },
  ]);
  expect(mask.select("card", { lifecycle: undefined, paths: [["value", "branch", "other"]] }).effective).toEqual([]);
});

test("legacy lifecycle occurrences remain even when every ordinary field is superseded", () => {
  const mask = new LegacyPendingMask();
  mask.select("card", { lifecycle: "restore", paths: [["value"]] });
  expect(mask.select("card", { lifecycle: "delete", paths: [["value"]] })).toEqual({
    lifecycle: "delete",
    dirty: [["value"]],
    effective: [],
  });
});

test("path masks keep record identity, sibling names and escaped key segments independent", () => {
  const mask = new LegacyPendingMask();
  mask.select("card", { lifecycle: undefined, paths: [["value", "a/b", "~key"]] });
  expect(mask.select("other", { lifecycle: undefined, paths: [["value", "a/b", "~key"]] }).effective).toHaveLength(1);
  expect(
    mask.select("card", {
      lifecycle: undefined,
      paths: [
        ["value", "a"],
        ["value", "a/b", "~other"],
      ],
    }).effective,
  ).toHaveLength(2);
});

test("a legacy frame cannot claim two record deltas under one migration edit identity", () => {
  const bytes = encodeRecordFrame({
    records: [
      { recordId: "card", bytes: new Uint8Array([0, 0]) },
      { recordId: "card", bytes: new Uint8Array([0, 0]) },
    ],
    assets: [],
  });
  expect(() => decodeLegacyPendingFrame(bytes)).toThrow("repeats a record");
});
