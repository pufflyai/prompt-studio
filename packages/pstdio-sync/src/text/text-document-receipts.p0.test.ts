import { expect, test } from "bun:test";
import * as Y from "yjs";
import { decodeCharacterMapping, encodeCharacterMapping } from "./text-document-receipts";

test("compressed character mappings retain original and canonical identities", () => {
  const mapping = new Map([
    ["7:1", Y.createID(11, 3)],
    ["7:2", Y.createID(11, 4)],
    ["7:3", null],
    ["7:4", null],
  ]);
  const encoded = encodeCharacterMapping(mapping);
  expect(encoded).toEqual([
    [7, 1, 2, 11, 3],
    [7, 3, 2, null, null],
  ]);
  expect(decodeCharacterMapping(encoded)).toEqual(mapping);
});

test("invalid character ranges are rejected before expansion", () => {
  for (const ranges of [
    [[1, 0, -1, 2, 0]],
    [[1, 0, 0, 2, 0]],
    [[1, 0.5, 1, 2, 0]],
    [[1, 0, 1, null, 0]],
    [[1, 0, 1, 2, null]],
    [[1, Number.MAX_SAFE_INTEGER, 1, 2, 0]],
    [
      [1, 0, 2, 2, 0],
      [1, 1, 1, 2, 2],
    ],
    [
      [2, 0, 1, 3, 0],
      [1, 0, 1, 3, 1],
    ],
  ])
    expect(() => decodeCharacterMapping(ranges as Parameters<typeof decodeCharacterMapping>[0])).toThrow(
      "Invalid text character mapping",
    );
});
