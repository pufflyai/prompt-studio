import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { withCloudReplacementWitness } from "./packaged-cloud-replacement-witness";

test("the next local save remains durable while its previous-state witness is downloading", async () => {
  const storage = createMemoryStorage();
  const downloading = Promise.withResolvers<void>();
  const downloaded = Promise.withResolvers<void>();
  await withCloudReplacementWitness(async (witness) => {
    witness.start(async () => {
      downloading.resolve();
      await downloaded.promise;
    });
    await downloading.promise;
    await storage.records.commit({
      operationId: "next-local-save",
      edits: [{ recordId: "note", replace: "offline next" }],
    });
    expect(await storage.records.outcome("next-local-save")).toMatchObject({ operationId: "next-local-save" });
    expect(await storage.records.read("note")).toMatchObject({ value: "offline next" });
    downloaded.resolve();
    await witness.wait();
  });
});

test("a failed local stage preserves a previous witness failure without leaving a rejection unobserved", async () => {
  const downloadFailure = new Error("Witness download failed");
  const localFailure = new Error("Local save failed");
  const failure = await withCloudReplacementWitness(async (witness) => {
    witness.start(async () => {
      throw downloadFailure;
    });
    await Promise.resolve();
    throw localFailure;
  }).catch((error: unknown) => error);
  expect(failure).toBeInstanceOf(AggregateError);
  expect((failure as AggregateError).errors).toEqual([localFailure, downloadFailure]);
});

test("the final witness finishes before the replacement phase reports success", async () => {
  const storage = createMemoryStorage();
  await withCloudReplacementWitness(async (witness) => {
    witness.start(async () => {
      await Promise.resolve();
      await storage.records.commit({
        operationId: "last-witness",
        edits: [{ recordId: "note", replace: "downloaded final" }],
      });
    });
  });
  expect(await storage.records.outcome("last-witness")).toMatchObject({ operationId: "last-witness" });
  expect(await storage.records.read("note")).toMatchObject({ value: "downloaded final" });
});
