import { expect, test } from "bun:test";
import { mergeExtensionReviewFile } from "./review-extension-source-merge";

const bytes = (text: string) => new TextEncoder().encode(text);

test("review merges disjoint line edits without losing final line endings", () => {
  expect(
    mergeExtensionReviewFile(
      bytes("header\r\nbody\r\nfooter"),
      bytes("local\r\nbody\r\nfooter"),
      bytes("header\r\nbody\r\nincoming"),
    ),
  ).toEqual({ kind: "merged", text: "local\r\nbody\r\nincoming" });
});

test("review keeps independent changes and treats competing edits as conflicts", () => {
  const base = bytes("base\n");
  expect(mergeExtensionReviewFile(base, bytes("local\n"), base)).toEqual({ kind: "keep-local" });
  expect(mergeExtensionReviewFile(base, base, null)).toEqual({ kind: "take-incoming" });
  expect(mergeExtensionReviewFile(base, null, bytes("incoming\n"))).toEqual({ kind: "conflict" });
  expect(mergeExtensionReviewFile(base, bytes("local\n"), bytes("incoming\n"))).toEqual({ kind: "conflict" });
  expect(mergeExtensionReviewFile(null, bytes("local\n"), bytes("incoming\n"))).toEqual({ kind: "conflict" });
});

test("two-way review never guesses ancestry or merges a changed binary file", () => {
  expect(mergeExtensionReviewFile(undefined, bytes("changed"), bytes("incoming"))).toEqual({ kind: "conflict" });
  expect(mergeExtensionReviewFile(undefined, bytes("same"), bytes("same"))).toEqual({ kind: "unchanged" });
  expect(mergeExtensionReviewFile(Uint8Array.of(0, 1), Uint8Array.of(0, 2), Uint8Array.of(0, 3))).toEqual({
    kind: "conflict",
  });
});
