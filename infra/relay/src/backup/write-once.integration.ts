import { afterEach, beforeEach, expect, test } from "bun:test";
import { input, reference } from "../assets/integration-fixture";
import { createAssetObjects } from "../assets/objects";
import { type BackupFixture, createBackupFixture } from "./integration-fixture";

let f: BackupFixture;
beforeEach(async () => {
  f = await createBackupFixture();
});
afterEach(async () => {
  await f?.close();
});

test("immutable backup keys reject delayed multipart and empty overwrites", async () => {
  const objects = createAssetObjects(f.backup);
  const key = "objects/immutable";
  const bytes = new TextEncoder().encode("original");
  const asset = reference(bytes);
  const signal = new AbortController().signal;
  const put = async (content: Uint8Array) => {
    const value = reference(content);
    const id = await objects.begin(key, value);
    const etag = await objects.write(key, id, 1, input(content), signal);
    try {
      await objects.finish(key, id, [{ number: 1, etag, sha256: value.sha256 }]);
    } catch (error) {
      await objects.discard(key, id);
      throw error;
    }
  };
  try {
    await put(bytes);
    await expect(put(new TextEncoder().encode("replaced"))).rejects.toThrow();
    await expect(objects.empty(key, reference(new Uint8Array()))).rejects.toThrow();
    await objects.verify(key, asset);
  } finally {
    objects.close();
  }
});
