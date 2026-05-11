import { describe, expect, it } from "bun:test";
import { resolveDiffEditorDataState } from "./diff-editor";
import type { DiffViewData } from "./diff-view-adapter";

const dataA = { hunks: ["a"] } as DiffViewData;
const dataB = { hunks: ["b"] } as DiffViewData;

describe("resolveDiffEditorDataState", () => {
  it("keeps the same diff data instance when file inputs are unchanged", () => {
    const input = {
      original: "one\ntwo\n",
      modified: "one\nchanged\n",
      oldPath: "src/file.ts",
      newPath: "src/file.ts",
    };

    const state = resolveDiffEditorDataState(null, input, () => dataA);
    const next = resolveDiffEditorDataState(state, { ...input }, () => dataB);

    expect(next).toBe(state);
    expect(next.data).toBe(dataA);
  });

  it("replaces diff data when file content changes", () => {
    const state = resolveDiffEditorDataState(
      null,
      {
        original: "one\ntwo\n",
        modified: "one\nchanged\n",
        oldPath: "src/file.ts",
        newPath: "src/file.ts",
      },
      () => dataA,
    );

    const next = resolveDiffEditorDataState(
      state,
      {
        original: "one\ntwo\n",
        modified: "one\nchanged again\n",
        oldPath: "src/file.ts",
        newPath: "src/file.ts",
      },
      () => dataB,
    );

    expect(next).not.toBe(state);
    expect(next.data).toBe(dataB);
  });
});
