import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { assetBytePaths } from "../storage/asset-byte-paths";
import { createAssetBytesStorage } from "./asset-bytes";

const roots: string[] = [];
const scope = { workbenchId: "shared", extensionId: "example" };
const stream = (value: string) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
const reference = (value: string) => ({
  sha256: createHash("sha256").update(value).digest("hex"),
  byteLength: Buffer.byteLength(value),
  mediaType: "application/octet-stream",
});

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

test("partial asset bytes survive reopening and publish only after complete verification", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-assets-"));
  roots.push(root);
  const asset = reference("abcdef");
  const first = createAssetBytesStorage(root);
  expect(await first.append(scope, "upload", 0, stream("abc"))).toBe(3);
  const reopened = createAssetBytesStorage(root);
  expect(await reopened.progress(scope, "upload")).toBe(3);
  expect(await reopened.publish(scope, "upload", asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await reopened.open(scope, asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await reopened.append(scope, "upload", 3, stream("def"))).toBe(6);
  expect(await reopened.publish(scope, "upload", asset)).toEqual(asset);
  expect(await new Response(await reopened.open(scope, asset)).text()).toBe("abcdef");
  expect(
    await reopened.open({ ...scope, workbenchId: "other" }, asset).catch((error: unknown) => error),
  ).toBeInstanceOf(Error);
  expect(
    await reopened.open({ ...scope, extensionId: "other" }, asset).catch((error: unknown) => error),
  ).toBeInstanceOf(Error);
});

test("integrity failure keeps staged bytes without publishing a readable version", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-assets-"));
  roots.push(root);
  const storage = createAssetBytesStorage(root);
  const asset = reference("correct");
  await storage.append(scope, "upload", 0, stream("invalid"));
  expect(await storage.publish(scope, "upload", asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await storage.open(scope, asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await storage.progress(scope, "upload")).toBe(7);
});

test("publication storage failures retain recoverable staged bytes without exposing a version", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-assets-"));
  roots.push(root);
  const storage = createAssetBytesStorage(root);
  const asset = reference("recoverable");
  await storage.append(scope, "upload", 0, stream("recoverable"));
  const versions = dirname(assetBytePaths(root, scope).version(asset.sha256));
  await mkdir(dirname(versions), { recursive: true });
  await writeFile(versions, "Unavailable storage directory");
  expect(await storage.publish(scope, "upload", asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await storage.open(scope, asset).catch((error: unknown) => error)).toBeInstanceOf(Error);
  expect(await storage.progress(scope, "upload")).toBe(asset.byteLength);
  await rm(versions);
  await storage.publish(scope, "upload", asset);
  expect(await new Response(await storage.open(scope, asset)).text()).toBe("recoverable");
});

test("upload bytes reach local storage before the next source chunk is requested", async () => {
  const root = await mkdtemp(join(tmpdir(), "pstdio-assets-"));
  roots.push(root);
  const storage = createAssetBytesStorage(root);
  const first = new Uint8Array(64 * 1024).fill(1);
  let chunks = 0;
  let progressBeforeSecondChunk = 0;
  const source = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        chunks++;
        if (chunks === 1) controller.enqueue(first);
        else {
          progressBeforeSecondChunk = await storage.progress(scope, "streaming");
          controller.enqueue(new Uint8Array(64 * 1024).fill(2));
          controller.close();
        }
      },
    },
    { highWaterMark: 0 },
  );
  expect(await storage.append(scope, "streaming", 0, source)).toBe(128 * 1024);
  expect(progressBeforeSecondChunk).toBe(first.byteLength);
});
