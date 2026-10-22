import { expect, test } from "bun:test";
import { createExtensionFileService } from "./extension-file-service";
import { blobFilesFixture } from "./shared-files/blob-files.fixture";

test("file ownership uses the workbench and canonical extension identity", async () => {
  const f = await blobFilesFixture();
  try {
    const file = (await f.service.upload({ ...f.scope, file_name: "note.md", data: Buffer.from("saved attachment") }))!;
    const canonical = { ...f.scope, extension_instance_id: f.owner.extensionId };
    expect((await f.service.list(canonical))?.map((file) => file.id)).toEqual([file.id]);
    const found = await f.service.getOwnedFile({ ...canonical, file_id: file.id });
    expect(await new Response(await f.service.read(found!)).text()).toBe("saved attachment");
    expect(await f.service.getOwnedFile({ ...canonical, project_id: "other-workbench", file_id: file.id })).toBeNull();
    expect(
      await f.service.getOwnedFile({ ...canonical, extension_instance_id: "other.extension", file_id: file.id }),
    ).toBeNull();
    expect(await f.service.remove({ ...canonical, file_id: file.id })).toBe(true);
    expect(await f.service.getOwnedFile({ ...canonical, file_id: file.id })).toBeNull();
    expect(await f.service.list(canonical)).toEqual([]);
  } finally {
    await f.close();
  }
});

test("existing local attachments import once with their scope, then a tombstone prevents resurrection", async () => {
  const f = await blobFilesFixture();
  try {
    const file = await f.fileService.upload(
      {
        project_id: f.scope.project_id,
        file_name: "legacy.txt",
        file_kind: "extension",
        data: Buffer.from("existing local bytes"),
      },
      async (file) => {
        await f.extensionFilesDBService.attach({
          ...f.scope,
          scope_type: "resource",
          scope_id: "note",
          file_id: file.id,
        });
      },
    );
    const files = await f.service.list({ ...f.scope, scope_type: "resource", scope_id: "note" });
    expect(files?.map((file) => file.id)).toEqual([file.id]);
    const found = (await f.service.getOwnedFile({ ...f.scope, file_id: file.id }))!;
    expect(await new Response(await f.service.read(found)).text()).toBe("existing local bytes");
    expect(await f.service.list(f.scope)).toEqual([]);
    expect(await f.service.remove({ ...f.scope, file_id: file.id })).toBe(true);
    expect(await f.service.list({ ...f.scope, scope_type: "resource", scope_id: "note" })).toEqual([]);
  } finally {
    await f.close();
  }
});

test("uploads reject instances outside their workbench before writing bytes", async () => {
  const f = await blobFilesFixture();
  try {
    expect(
      await f.service.upload({
        ...f.scope,
        project_id: "other",
        file_name: "private.txt",
        data: Buffer.from("private"),
      }),
    ).toBeNull();
    expect(await f.storage.records.list()).toEqual([]);
  } finally {
    await f.close();
  }
});

test("interrupted legacy cleanup keeps ownership until the durable replacement can be retried", async () => {
  const f = await blobFilesFixture();
  try {
    const file = await f.fileService.upload(
      {
        project_id: f.scope.project_id,
        file_name: "legacy.txt",
        file_kind: "extension",
        data: Buffer.from("durable bytes"),
      },
      async (file) => {
        await f.extensionFilesDBService.attach({ ...f.scope, file_id: file.id });
      },
    );
    const interrupted = createExtensionFileService({
      ...f.fileDeps,
      fileService: {
        ...f.fileService,
        remove: async () => {
          throw new Error("storage interrupted");
        },
      },
    });
    await expect(interrupted.list(f.scope)).rejects.toThrow("storage interrupted");
    expect(await f.extensionFilesDBService.getOwnedFile({ ...f.scope, file_id: file.id })).not.toBeNull();
    expect((await f.service.list(f.scope))?.map((file) => file.id)).toEqual([file.id]);
    expect(await f.extensionFilesDBService.getOwnedFile({ ...f.scope, file_id: file.id })).toBeNull();
    const saved = (await f.service.getOwnedFile({ ...f.scope, file_id: file.id }))!;
    expect(await new Response(await f.service.read(saved)).text()).toBe("durable bytes");
  } finally {
    await f.close();
  }
});
