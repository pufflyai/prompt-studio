import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { createFilesStorageService } from "pstdio-storage";
import type { SessionsRouteDeps } from "./deps";
import { resolveSessionAttachments } from "./session-attachments";

const roots: string[] = [];
const temporaryRoot = async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-attach-test-"));
  roots.push(root);
  return root;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const writeStoredFile = async (data: Buffer) => {
  const dir = await temporaryRoot();
  const storagePath = join(dir, "stored-file-no-extension");
  await writeFile(storagePath, data);
  return storagePath;
};

const depsWith = (file: unknown) =>
  ({ fileService: { get: async () => file } }) as unknown as Pick<SessionsRouteDeps, "fileService">;

describe("resolveSessionAttachments", () => {
  it("keeps readable files current and removes them with their stored attachment", async () => {
    const root = await temporaryRoot();
    const storage = createFilesStorageService(root);
    const fileId = crypto.randomUUID();
    const storagePath = storage.writeFile("project-1", fileId, Buffer.from("first"));
    const file = {
      id: fileId,
      project_id: "project-1",
      file_kind: "session_attachment",
      file_name: "note.txt",
      storage_path: storagePath,
    };
    try {
      const [attachment] = await resolveSessionAttachments(depsWith(file), "project-1", [{ file_id: fileId }]);
      storage.writeFile("project-1", fileId, Buffer.from("updated"));
      const [updated] = await resolveSessionAttachments(depsWith(file), "project-1", [{ file_id: fileId }]);
      expect(await readFile(updated.localPath, "utf8")).toBe("updated");
      storage.deleteFile(storagePath);
      expect(await Bun.file(attachment.localPath).exists()).toBe(false);
      expect(await Bun.file(updated.localPath).exists()).toBe(false);
    } finally {
      storage.removeProjectStorage("project-1");
    }
  });

  it("removes readable attachments when project storage is deleted", async () => {
    const root = await temporaryRoot();
    const storage = createFilesStorageService(root);
    const fileId = crypto.randomUUID();
    const storagePath = storage.writeFile("project-1", fileId, Buffer.from("data"));
    const file = {
      id: fileId,
      project_id: "project-1",
      file_kind: "session_attachment",
      file_name: "note.txt",
      storage_path: storagePath,
    };
    const [attachment] = await resolveSessionAttachments(depsWith(file), "project-1", [{ file_id: fileId }]);
    storage.removeProjectStorage("project-1");
    expect(await Bun.file(attachment.localPath).exists()).toBe(false);
  });

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

    expect(basename(attachment.localPath) === "diagram.png").toBe(true);
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
      Array.from({ length: 20 }, async () => {
        const [attachment] = await resolveSessionAttachments(depsWith(file), "project-1", refs);
        return { attachment, contents: await readFile(attachment.localPath) };
      }),
    );

    for (const { attachment, contents } of results) {
      expect(basename(attachment.localPath) === "shared.txt").toBe(true);
      expect(contents).toEqual(bytes);
    }
  });
});
