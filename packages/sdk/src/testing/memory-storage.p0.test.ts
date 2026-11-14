import { expect, test } from "bun:test";
import { createMemoryStorage } from "./memory-storage";

test("extension test storage stages immutable assets, retries identities, and retains completed bytes", async () => {
  const storage = createMemoryStorage();
  const source = new Blob(["test bytes"], { type: "application/example" });
  const asset = await storage.assets.stage({ operationId: "upload", source });
  expect(Object.keys(asset).sort()).toEqual(["byteLength", "mediaType", "sha256"]);
  expect(await storage.assets.stage({ operationId: "upload", source })).toEqual(asset);
  expect(await storage.assets.getTransfer("upload")).toEqual({ status: "complete", operationId: "upload", asset });
  await storage.assets.verifyComplete([asset]);
  expect(await new Response(await storage.scope({ type: "project" }).assets.read(asset)).text()).toBe("test bytes");
  expect(await storage.assets.cancel("upload")).toMatchObject({ status: "complete" });
  expect(await new Response(await storage.assets.read(asset)).text()).toBe("test bytes");
  const conflict = await storage.assets
    .stage({ operationId: "upload", source: new Blob(["changed"]) })
    .catch((error: unknown) => error);
  expect(conflict).toBeInstanceOf(Error);
  const missing = await createMemoryStorage()
    .assets.read(asset)
    .catch((error: unknown) => error);
  expect(missing).toBeInstanceOf(Error);
});

test("record asset snapshots cannot mutate storage without a commit", async () => {
  const storage = createMemoryStorage();
  const asset = await storage.assets.stage({ operationId: "image", source: new Blob(["image"]) });
  await storage.records.commit({ operationId: "save", edits: [{ recordId: "image", asset }] });
  const record = await storage.records.read("image");
  record.asset!.byteLength = 99;
  expect((await storage.records.read("image")).asset).toEqual(asset);
});
