import { describe, expect, it } from "bun:test";
import { createFileUploadValues, getFileUploadSummary } from "./file-upload-value";

describe("createFileUploadValues", () => {
  it("appends queued files for a multiple upload", () => {
    const existing = createFileUploadValues([new File(["first"], "first.txt")], [], true);
    const next = createFileUploadValues([new File(["second"], "second.txt")], existing, true);

    expect(next.map(({ file, status }) => ({ name: file.name, status }))).toEqual([
      { name: "first.txt", status: "queued" },
      { name: "second.txt", status: "queued" },
    ]);
  });

  it("replaces the queue for a single-file upload", () => {
    const existing = createFileUploadValues([new File(["first"], "first.txt")], [], true);
    const next = createFileUploadValues([new File(["second"], "second.txt")], existing, false);

    expect(next).toHaveLength(1);
    expect(next[0].file.name).toBe("second.txt");
  });
});

describe("getFileUploadSummary", () => {
  it("prioritizes active uploads and reports their count", () => {
    const values = createFileUploadValues(
      [new File(["first"], "first.txt"), new File(["second"], "second.txt")],
      [],
      true,
    ).map((value) => ({ ...value, status: "uploading" as const }));

    expect(getFileUploadSummary(values)).toEqual({ state: "uploading", count: 2 });
  });
});
