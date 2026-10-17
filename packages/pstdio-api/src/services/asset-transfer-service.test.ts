import { afterAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssetTransfersDBService, createDb, createProjectsDBService } from "pstdio-db";
import { createAssetBytesStorage } from "pstdio-storage";
import { createAssetTransferService } from "./asset-transfer-service";

const bytes = (value: string) => new Blob([value]).stream();
const asset = (value: string) => ({
  sha256: createHash("sha256").update(value).digest("hex"),
  byteLength: Buffer.byteLength(value),
  mediaType: "text/plain",
});

test("upload identity and partial bytes survive runtime restart and complete retries preserve one version", async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-transfer-"));
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example" };
  const expected = asset("abcdef");
  const first = await createDb({ path: join(root, "db") });
  try {
    await createProjectsDBService(first.db).create({ id: owner.workbenchId, name: "Shared" });
    const service = createAssetTransferService({
      transfers: createAssetTransfersDBService(first.db),
      bytes: createAssetBytesStorage(join(root, "bytes")),
    });
    expect(await service.begin(owner, "operation", expected)).toMatchObject({
      status: "staging",
      uploadedByteLength: 0,
    });
    await service.append(owner, "operation", 0, bytes("abc"));
    expect(await service.get(owner, "operation")).toMatchObject({ status: "staging", uploadedByteLength: 3 });
  } finally {
    await first.close();
  }
  const restarted = await createDb({ path: join(root, "db") });
  try {
    const service = createAssetTransferService({
      transfers: createAssetTransfersDBService(restarted.db),
      bytes: createAssetBytesStorage(join(root, "bytes")),
    });
    expect(await service.begin(owner, "operation", expected)).toMatchObject({
      status: "staging",
      uploadedByteLength: 3,
    });
    const conflict = await service.begin(owner, "operation", asset("changed")).catch((error: unknown) => error);
    expect(conflict).toMatchObject({
      code: "ASSET_OPERATION_CONFLICT",
    });
    const duplicate = await service.append(owner, "operation", 0, bytes("abc")).catch((error: unknown) => error);
    expect(duplicate).toMatchObject({
      code: "ASSET_OFFSET_MISMATCH",
    });
    await service.append(owner, "operation", 3, bytes("def"));
    expect(await service.complete(owner, "operation")).toEqual({
      status: "complete",
      operationId: "operation",
      asset: expected,
    });
    expect(await service.complete(owner, "operation")).toEqual({
      status: "complete",
      operationId: "operation",
      asset: expected,
    });
    expect(await new Response(await service.read(owner, expected)).text()).toBe("abcdef");
    expect(await service.begin(owner, "another", expected)).toMatchObject({ status: "complete", asset: expected });
    expect(await service.get({ ...owner, extensionId: "other" }, "operation")).toBeNull();
    const foreign = await service
      .read({ ...owner, workbenchId: crypto.randomUUID() }, expected)
      .catch((error: unknown) => error);
    expect(foreign).toBeInstanceOf(Error);
  } finally {
    await restarted.close();
    await rm(root, { recursive: true, force: true });
  }
});

let sharedMetadata: Awaited<ReturnType<typeof createDb>> | undefined;
afterAll(async () => {
  await sharedMetadata?.close();
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "asset-transfer-"));
  sharedMetadata ??= await createDb({ path: ":memory:" });
  const database = sharedMetadata;
  const owner = { workbenchId: crypto.randomUUID(), extensionId: "example" };
  await createProjectsDBService(database.db).create({ id: owner.workbenchId, name: "Shared" });
  const storage = createAssetBytesStorage(root);
  const service = createAssetTransferService({ transfers: createAssetTransfersDBService(database.db), bytes: storage });
  return {
    owner,
    storage,
    service,
    close: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
};

test("explicit cancellation removes temporary bytes and preserves retained complete versions", async () => {
  const { owner, storage, service, close } = await fixture();
  try {
    const retained = asset("kept");
    await service.begin(owner, "keep", retained);
    await service.append(owner, "keep", 0, bytes("kept"));
    await service.complete(owner, "keep");
    await service.begin(owner, "cancel", asset("pending"));
    await service.append(owner, "cancel", 0, bytes("pen"));
    expect(await service.cancel(owner, "cancel")).toMatchObject({ status: "cancelled" });
    expect(await storage.progress(owner, "cancel")).toBe(0);
    expect(await service.get(owner, "cancel")).toMatchObject({ status: "cancelled" });
    expect(await new Response(await service.read(owner, retained)).text()).toBe("kept");
    expect(await service.cancel(owner, "keep")).toMatchObject({ status: "complete" });
  } finally {
    await close();
  }
});

test("a disconnected upload preserves its prefix for automatic resume instead of cancelling the operation", async () => {
  const { owner, storage, service, close } = await fixture();
  const waiting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const request = new AbortController();
  let chunks = 0;
  let interrupted = false;
  const source = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (chunks++ === 0) controller.enqueue(new TextEncoder().encode("first"));
        else {
          waiting.resolve();
          await release.promise;
        }
      },
      cancel() {
        interrupted = true;
        release.resolve();
      },
    },
    { highWaterMark: 0 },
  );
  const expected = asset("firstsecond");
  await service.begin(owner, "resume", expected);
  const upload = service.append(owner, "resume", 0, source, request.signal).catch((error: unknown) => error);
  try {
    await waiting.promise;
    request.abort();
    expect(await upload).toMatchObject({ name: "AbortError" });
    expect(interrupted).toBe(true);
    expect(await storage.progress(owner, "resume")).toBe(5);
    expect(await service.get(owner, "resume")).toMatchObject({ status: "staging", uploadedByteLength: 5 });
    await service.append(owner, "resume", 5, bytes("second"));
    expect(await service.complete(owner, "resume")).toMatchObject({ status: "complete", asset: expected });
  } finally {
    request.abort();
    release.resolve();
    await upload;
    await close();
  }
});

test("concurrent writes at one offset cannot append duplicate content", async () => {
  const { owner, service, storage, close } = await fixture();
  try {
    await service.begin(owner, "concurrent", asset("same"));
    const results = await Promise.all([
      service.append(owner, "concurrent", 0, bytes("same")).catch((error: unknown) => error),
      service.append(owner, "concurrent", 0, bytes("same")).catch((error: unknown) => error),
    ]);
    expect(results).toContainEqual(expect.objectContaining({ status: "staging", uploadedByteLength: 4 }));
    expect(results).toContainEqual(expect.objectContaining({ code: "ASSET_OFFSET_MISMATCH" }));
    expect(await storage.progress(owner, "concurrent")).toBe(4);
    expect(await service.complete(owner, "concurrent")).toMatchObject({ status: "complete" });
  } finally {
    await close();
  }
});

test("extension staging returns a portable retained reference and resumes a previously stored prefix", async () => {
  const { owner, service, close } = await fixture();
  try {
    const source = new Blob(["abcdef"], { type: "text/plain" });
    const expected = { ...asset("abcdef"), mediaType: source.type };
    await service.begin(owner, "stage", expected);
    await service.append(owner, "stage", 0, bytes("abc"));
    const reference = await service.stage(owner, "stage", source);
    expect(reference).toEqual(expected);
    await service.verifyComplete(owner, [reference]);
    expect(await new Response(await service.read(owner, reference)).text()).toBe("abcdef");
    expect(await service.stage(owner, "stage", source)).toEqual(reference);
    const invocation = new AbortController();
    const stream = await service.read(owner, reference, invocation.signal);
    invocation.abort();
    const interrupted = await new Response(stream).text().catch((error: unknown) => error);
    expect(interrupted).toMatchObject({ name: "AbortError" });
  } finally {
    await close();
  }
});

test("concurrent extension staging retries the same operation without caller retry logic", async () => {
  const { owner, service, close } = await fixture();
  try {
    const source = new Blob(["duplicate"], { type: "application/example" });
    const expected = { ...asset("duplicate"), mediaType: source.type };
    const outcomes = await Promise.allSettled([
      service.stage(owner, "duplicate", source),
      service.stage(owner, "duplicate", source),
    ]);
    expect(outcomes).toEqual([
      { status: "fulfilled", value: expected },
      { status: "fulfilled", value: expected },
    ]);
    expect(await new Response(await service.read(owner, expected)).text()).toBe("duplicate");
  } finally {
    await close();
  }
});

test("a failed integrity check preserves incomplete bytes and never returns a complete reference", async () => {
  const { owner, service, close } = await fixture();
  try {
    const expected = asset("valid");
    await service.begin(owner, "bad", expected);
    await service.append(owner, "bad", 0, bytes("wrong"));
    const error = await service.complete(owner, "bad").catch((error: unknown) => error);
    expect(error).toMatchObject({ code: "ASSET_INTEGRITY_MISMATCH" });
    expect(await service.get(owner, "bad")).toMatchObject({ status: "staging", uploadedByteLength: 5 });
    const missing = await service.read(owner, expected).catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(Error);
  } finally {
    await close();
  }
});

test("zero byte assets complete without a content request and remain readable", async () => {
  const { owner, service, close } = await fixture();
  try {
    const expected = asset("");
    await service.begin(owner, "empty", expected);
    expect(await service.complete(owner, "empty")).toEqual({
      status: "complete",
      operationId: "empty",
      asset: expected,
    });
    expect(await new Response(await service.read(owner, expected)).text()).toBe("");
  } finally {
    await close();
  }
});

test("cancellation interrupts opening a receive source before any byte stream exists", async () => {
  const { owner, service, close } = await fixture();
  const opening = Promise.withResolvers<AbortSignal>();
  const release = Promise.withResolvers<ReadableStream<Uint8Array>>();
  const lateCancelled = Promise.withResolvers<void>();
  const download = service
    .receive(owner, "opening", asset("waiting"), async (_offset, signal) => {
      opening.resolve(signal);
      return release.promise;
    })
    .catch((error: unknown) => error);
  try {
    expect(await opening.promise).toBeInstanceOf(AbortSignal);
    expect(await service.cancel(owner, "opening")).toMatchObject({ status: "cancelled" });
    expect(await download).toMatchObject({ code: "ASSET_TRANSFER_CANCELLED" });
    release.resolve(new ReadableStream({ cancel: () => lateCancelled.resolve() }));
    await lateCancelled.promise;
  } finally {
    release.resolve(bytes("waiting"));
    await download;
    await close();
  }
});

test("explicit cancellation interrupts an active stream before cleaning its partial bytes", async () => {
  const { owner, storage, service, close } = await fixture();
  const waiting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let chunks = 0;
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        chunks++;
        if (chunks === 1) controller.enqueue(new TextEncoder().encode("first"));
        else {
          waiting.resolve();
          await release.promise;
          if (!cancelled) {
            controller.enqueue(new TextEncoder().encode("second"));
            controller.close();
          }
        }
      },
      cancel() {
        cancelled = true;
        release.resolve();
      },
    },
    { highWaterMark: 0 },
  );
  await service.begin(owner, "active", asset("firstsecond"));
  const upload = service.append(owner, "active", 0, source).catch((error: unknown) => error);
  let cancellation: ReturnType<typeof service.cancel> | undefined;
  try {
    await waiting.promise;
    cancellation = service.cancel(owner, "active");
    await Promise.resolve();
    expect(cancelled).toBe(true);
    expect(await cancellation).toMatchObject({ status: "cancelled" });
    expect(await storage.progress(owner, "active")).toBe(0);
  } finally {
    release.resolve();
    await Promise.allSettled([upload, cancellation]);
    await close();
  }
});
