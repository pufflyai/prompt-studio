import { describe, expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createMemoryRepoFiles, createMemoryStorage } from "@pstdio/sdk/testing";
import { REPORTS_COLLECTION, reportsCollection } from "../data/collections";
import { reportFilesDir } from "../data/draft-storage";
import { reportLookupIndex } from "../data/report-lookup";
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
      async updateIfUnchanged(_id, _revision, _value) {
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
    const storage = createMemoryStorage({ indexes: [reportLookupIndex] });
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
    const reports = reportsCollection(storage);
    const first = (await reports.get(written.reportId))!;
    const file = first.files[0]!;
    await saveReportCommand.run(...args);
    const unchanged = (await reports.get(written.reportId))!;
    expect(unchanged.files[0]!.id).toBe(file.id);
    expect(unchanged.files[0]!.blobId).toBe(file.blobId);
    expect(unchanged.bodyBlobId).toBe(first.bodyBlobId);

    await projectFiles.writeText(`${reportFilesDir("review")}/evidence.txt`, "Revised evidence");
    await saveReportCommand.run(...args);
    const changed = (await reports.get(written.reportId))!;
    expect(changed.files[0]!.id).toBe(file.id);
    expect(changed.files[0]!.blobId).not.toBe(file.blobId);
    expect(changed.bodyBlobId).toBe(first.bodyBlobId);
    expect(await reports.attachments(written.reportId).get(file.blobId)).toBeUndefined();
    expect(await reports.attachments(written.reportId).get(first.bodyBlobId)).toBeDefined();
    expect(allocated).toEqual([file.id]);
  });

  test("preserves the storage write error when rollback blob cleanup fails", async () => {
    const storage = createMemoryStorage({ indexes: [reportLookupIndex] });
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
