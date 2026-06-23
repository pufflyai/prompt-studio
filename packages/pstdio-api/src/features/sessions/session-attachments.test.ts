import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SessionsRouteDeps } from "./deps";
import { resolveSessionAttachments } from "./session-attachments";

const writeStoredFile = async (data: Buffer) => {
  const dir = await mkdtemp(join(tmpdir(), "pstdio-attach-test-"));
  const storagePath = join(dir, "stored-file-no-extension");
  await writeFile(storagePath, data);
  return storagePath;
};

const depsWith = (file: unknown) =>
  ({ fileService: { get: async () => file } }) as unknown as Pick<SessionsRouteDeps, "fileService">;

describe("resolveSessionAttachments", () => {
  it("exposes the bytes through a path that keeps the original filename extension", async () => {
    const bytes = Buffer.from("89504e470d0a1a0a", "hex");
    const storagePath = await writeStoredFile(bytes);
    const fileId = crypto.randomUUID();

    const file = {
      id: fileId,
      project_id: "project-1",
      file_kind: "session_attachment",
      file_name: "diagram.png",
      mime_type: "image/png",
      size_bytes: bytes.byteLength,
      storage_path: storagePath,
    };

    const [attachment] = await resolveSessionAttachments(depsWith(file), "project-1", [{ file_id: fileId }]);

    expect(attachment.localPath.endsWith("/diagram.png")).toBe(true);
    expect(await readFile(attachment.localPath)).toEqual(bytes);
  });

  it("resolves simultaneous callers for the same attachment", async () => {
    const bytes = Buffer.from("shared attachment");
    const storagePath = await writeStoredFile(bytes);
    const fileId = crypto.randomUUID();
    const refs = [{ file_id: fileId }];
    const file = {
      id: fileId,
      project_id: "project-1",
      file_kind: "session_attachment",
      file_name: "shared.txt",
      mime_type: "text/plain",
      size_bytes: bytes.byteLength,
      storage_path: storagePath,
    };

    const results = await Promise.all(
      Array.from({ length: 20 }, () => resolveSessionAttachments(depsWith(file), "project-1", refs)),
    );

    for (const [attachment] of results) {
      expect(attachment.localPath.endsWith("/shared.txt")).toBe(true);
      expect(await readFile(attachment.localPath)).toEqual(bytes);
    }
  });
});
