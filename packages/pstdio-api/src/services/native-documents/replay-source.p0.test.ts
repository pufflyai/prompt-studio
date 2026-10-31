import { expect, test } from "bun:test";
import { importTextSource, seedTextDocument } from "pstdio-sync/text";
import * as Y from "yjs";
import { validateReplaySource } from "./replay-source";

test("a recovery history cannot enter another source lifetime even when its source bytes are identical", async () => {
  const document = new Y.Doc();
  try {
    await importTextSource(document, "a".repeat(64), "same bytes");
    const state = Y.encodeStateAsUpdate(document);
    expect(() => validateReplaySource(state, "b".repeat(64), "recreated")).toThrow("another source lifetime");
    expect(() => validateReplaySource(state, "a".repeat(64), "initial")).not.toThrow();
  } finally {
    document.destroy();
  }
});

test("unbound initial history remains recoverable but cannot prove ownership of a recreated source", async () => {
  const document = new Y.Doc();
  try {
    await seedTextDocument(document, "same bytes");
    const state = Y.encodeStateAsUpdate(document);
    expect(() => validateReplaySource(state, "a".repeat(64), "initial")).not.toThrow();
    expect(() => validateReplaySource(state, "a".repeat(64), "recreated")).toThrow("another source lifetime");
  } finally {
    document.destroy();
  }
});
