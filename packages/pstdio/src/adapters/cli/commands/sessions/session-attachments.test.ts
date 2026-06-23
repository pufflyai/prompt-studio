import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inferMimeType, uploadCliSessionAttachments } from "./session-attachments";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createTempRoot = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-cli-session-attachments-test-"));
  tempRoots.push(root);
  return root;
};

describe("uploadCliSessionAttachments", () => {
  test("infers MIME types for supported attachment files", () => {
    expect(inferMimeType("context.csv")).toBe("text/csv");
    expect(inferMimeType("diagram.svg")).toBe("image/svg+xml");
    expect(inferMimeType("notes.pdf")).toBe("application/pdf");
    expect(inferMimeType("planning.xlsx")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  });

  test("deletes already uploaded attachments when a later upload fails", async () => {
    const root = createTempRoot();
    writeFileSync(join(root, "first.txt"), "first");
    writeFileSync(join(root, "second.txt"), "second");
    const deleteAttachment = mock(async () => undefined);
    const uploadAttachment = mock(async (_projectId: string, input: { name: string }) => {
      if (input.name === "second.txt") throw new Error("upload failed");
      return {
        file_id: "file-1",
        name: input.name,
        mime_type: "text/plain",
        size_bytes: 5,
        hash: null,
        url: "/content/file-1",
        created_at: "2026-06-17T00:00:00.000Z",
        updated_at: "2026-06-17T00:00:00.000Z",
      };
    });

    await expect(
      uploadCliSessionAttachments({
        projectId: "project-1",
        paths: ["first.txt", "second.txt"],
        cwd: root,
        uploadAttachment,
        deleteAttachment,
      }),
    ).rejects.toThrow("upload failed");

    expect(deleteAttachment).toHaveBeenCalledWith("project-1", "file-1");
  });
});
