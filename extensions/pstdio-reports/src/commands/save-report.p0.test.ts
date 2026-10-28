import { describe, expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { REPORTS_COLLECTION, reportsCollection } from "../data/collections";
import { reportFilesDir } from "../data/draft-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { saveReportCommand } from "./save-report";
import { writeReportCommand } from "./write-report";

const failReportPutAndBlobDeletes = (storage: ExtensionStorageApi): ExtensionStorageApi => ({
  ...storage,
  collection<TItem>(name: string) {
    const collection = storage.collection<TItem>(name);
    if (name !== REPORTS_COLLECTION) return collection;

    return {
      ...collection,
      async put(_id, _value) {
        throw new Error("storage write failed");
      },
      attachments(itemId) {
        const blobs = collection.attachments(itemId);
        return {
          ...blobs,
          async delete(id) {
            await blobs.delete(id);
            throw new Error("blob cleanup failed");
          },
        };
      },
    };
  },
});

describe("save report", () => {
  test("new evidence files use core IDs and keep them on later saves", async () => {
    const storage = createMemoryStorage();
    const projectFiles = createMemoryRepoFiles();
    const written = await writeReportCommand.run(
      ...makeCommandArgs({ storage, params: { name: "review", template: "review" }, overrides: { projectFiles } }),
    );
    const allocated: string[] = [];
    const allocate = storage.ids.create;
    storage.ids.create = () => {
      const id = allocate();
      allocated.push(id);
      return id;
    };
    await projectFiles.writeText(`${reportFilesDir("review")}/evidence.txt`, "Evidence");
    const args = makeCommandArgs({ storage, params: { name: "review" }, overrides: { projectFiles } });
    await saveReportCommand.run(...args);
    const first = (await reportsCollection(storage).get(written.reportId))!.files[0]!;
    expect(allocated).toEqual([first.id]);
    await saveReportCommand.run(...args);
    expect((await reportsCollection(storage).get(written.reportId))!.files[0]!.id).toBe(first.id);
    expect(allocated).toHaveLength(1);
  });

  test("preserves the storage write error when rollback blob cleanup fails", async () => {
    const storage = createMemoryStorage();
    const projectFiles = createMemoryRepoFiles();
    await writeReportCommand.run(
      ...makeCommandArgs({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { projectFiles },
      }),
    );
    projectFiles.files.set(`${reportFilesDir("review")}/evidence.txt`, new TextEncoder().encode("details"));

    await expect(
      saveReportCommand.run(
        ...makeCommandArgs({
          storage: failReportPutAndBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { projectFiles },
        }),
      ),
    ).rejects.toThrow("storage write failed");
  });
});
