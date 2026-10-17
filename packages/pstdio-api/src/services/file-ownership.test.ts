import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb, createFilesDBService, createProjectsDBService } from "pstdio-db";
import { createAssetBytesStorage, createFilesStorageService, readableFilePath } from "pstdio-storage";
import { EventBus } from "../features/sync/event-bus";
import { createFileService } from "./file-service";

test("project file cleanup preserves another workbench's retained assets and updates existing stored paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "file-ownership-"));
  const database = await createDb({ path: ":memory:" });
  try {
    const projectId = "asset-bytes";
    await createProjectsDBService(database.db).create({ id: projectId, name: "Opaque workbench identity" });
    const files = createFilesDBService(database.db);
    const service = createFileService({
      filesDBService: files,
      filesStorageService: createFilesStorageService(root),
      eventBus: new EventBus(),
    });
    const assetOwner = { workbenchId: "another-workbench", extensionId: "example" };
    const bytes = createAssetBytesStorage(root);
    const asset = {
      sha256: createHash("sha256").update("retained").digest("hex"),
      byteLength: 8,
      mediaType: "application/octet-stream",
    };
    await bytes.append(assetOwner, "retained", 0, new Blob(["retained"]).stream());
    await bytes.publish(assetOwner, "retained", asset);
    const fileId = crypto.randomUUID();
    const legacyPath = join(root, projectId, fileId);
    await mkdir(join(root, projectId), { recursive: true });
    await writeFile(legacyPath, "legacy");
    const timestamp = new Date().toISOString();
    await files.insert({
      id: fileId,
      project_id: projectId,
      file_name: "legacy.txt",
      file_kind: "extension",
      storage_path: legacyPath,
      mime_type: "text/plain",
      size_bytes: 6,
      hash: null,
      created_at: timestamp,
      updated_at: timestamp,
    });
    const readable = await readableFilePath(legacyPath, "legacy.txt");
    await service.update(fileId, { data: Buffer.from("updated") });
    expect(await readFile((await files.get(fileId))!.storage_path, "utf8")).toBe("updated");
    expect(await readFile(readable, "utf8")).toBe("updated");
    await service.upload({
      project_id: projectId,
      file_name: "new.txt",
      file_kind: "extension",
      data: Buffer.from("new"),
    });
    await service.removeProjectStorage(projectId);
    expect(await Bun.file(legacyPath).exists()).toBe(false);
    expect(await Bun.file(readable).exists()).toBe(false);
    expect(await new Response(await bytes.open(assetOwner, asset)).text()).toBe("retained");
  } finally {
    await database.close();
    await rm(root, { recursive: true, force: true });
  }
});
