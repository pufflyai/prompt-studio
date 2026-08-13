import { describe, expect, test } from "bun:test";
import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { REPORTS_COLLECTION } from "../data/collections";
import { reportFilesDir } from "../data/draft-storage";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandContext } from "./command-context.fixture";
import { createMemoryRepoFiles } from "./repo-files.fixture";
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
  test("preserves the storage write error when rollback blob cleanup fails", async () => {
    const storage = createMemoryStorage();
    const repoFiles = createMemoryRepoFiles();
    await writeReportCommand.run(
      makeCommandContext({
        storage,
        params: { workspace: "PS-116_A1", kind: "review", template: "review" },
        overrides: { repoFiles },
      }),
    );
    repoFiles.files.set(`${reportFilesDir("review")}/evidence.txt`, new TextEncoder().encode("details"));

    await expect(
      saveReportCommand.run(
        makeCommandContext({
          storage: failReportPutAndBlobDeletes(storage),
          params: { workspace: "PS-116_A1", name: "review" },
          overrides: { repoFiles },
        }),
      ),
    ).rejects.toThrow("storage write failed");
  });
});
