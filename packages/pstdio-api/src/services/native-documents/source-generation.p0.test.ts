import { expect, test } from "bun:test";
import { seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { validateReplaySource } from "./replay-source";
import { validateNativeSourceAuthority } from "./validate-writable-source";

const source = { owner: { workbenchId: "project", extensionId: "example.board" }, documentKey: "a".repeat(64) };

test("a local replica fence retires an admitted authority without changing the canonical source", () => {
  expect(() => validateNativeSourceAuthority({ ...source, generation: "after-refusal" }, source)).toThrow("replica");
  expect(() =>
    validateNativeSourceAuthority(
      { ...source, generation: "after-refusal" },
      { ...source, generation: "before-refusal" },
    ),
  ).toThrow("replica");
  expect(() =>
    validateNativeSourceAuthority(
      { ...source, generation: "after-refusal" },
      { ...source, generation: "after-refusal" },
    ),
  ).not.toThrow();
});

test("a full-state recovery needs the current replica proof even when its Yjs seed is unchanged", async () => {
  const document = new Y.Doc();
  try {
    await seedTextDocument(document, "shared canonical source");
    const state = Y.encodeStateAsUpdate(document);
    expect(() => validateReplaySource(state, source.documentKey, "initial", "current", undefined)).toThrow("replica");
    expect(() => validateReplaySource(state, source.documentKey, "initial", "current", "retired")).toThrow("replica");
    expect(() => validateReplaySource(state, source.documentKey, "initial", "current", "current")).not.toThrow();
    expect(() => validateReplaySource(undefined, source.documentKey, "initial", "current", undefined)).not.toThrow();
  } finally {
    document.destroy();
  }
});
