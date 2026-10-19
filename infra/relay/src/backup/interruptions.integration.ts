import { afterEach, beforeEach, expect, test } from "bun:test";
import { DeleteObjectCommand, ListMultipartUploadsCommand } from "@aws-sdk/client-s3";
import { type BackupFixture, createBackupFixture } from "./integration-fixture";
import { createBackupObjects } from "./objects";

let f: BackupFixture;
beforeEach(async () => {
  f = await createBackupFixture();
});
afterEach(async () => {
  await f?.close();
});

test("failed capture releases only backup pins and never supplies coverage", async () => {
  const populated = await f.populate();
  const foreign = await populated.owner.capture();
  const row = (
    await f.pool.query("SELECT \"objectKey\" FROM relay_verified_assets WHERE asset->>'sha256'=$1", [
      populated.asset.sha256,
    ])
  ).rows[0];
  await f.base.client.send(new DeleteObjectCommand({ Bucket: f.base.config.bucket, Key: row.objectKey }));
  const worker = f.worker();
  const now = Date.now();
  await expect(worker.tick(now)).rejects.toThrow();
  expect((await f.pins()).map((pin) => pin.id)).toEqual([foreign.id]);
  const catalog = f.catalog();
  expect((await catalog.readCoverage(now)).state).toBe("failed");
  expect((await catalog.readCoverage(now)).coverage).toEqual([]);
  expect(await f.list(f.backup.bucket, "complete/")).toHaveLength(0);
  await f.put(populated.scope, populated.bytes);
  await worker.tick(now + 3_600_000);
  expect((await catalog.readCoverage(now + 3_600_000)).state).toBe("verified");
  expect((await f.pins()).map((pin) => pin.id)).toEqual([foreign.id]);
  await populated.owner.releaseCapture(foreign.id);
});

test("interrupting the database capture leaves no complete snapshot and replacement can finish", async () => {
  await f.populate();
  const blocker = await f.pool.connect();
  const worker = f.worker();
  const catalog = f.catalog();
  const controller = new AbortController();
  await blocker.query("BEGIN");
  await blocker.query("LOCK TABLE relay_scopes IN SHARE MODE");
  const running = worker.tick(Date.now(), controller.signal);
  const settled = running.then(
    () => null,
    (error) => error,
  );
  try {
    while (
      !(
        await f.pool.query(
          "SELECT 1 FROM pg_locks l JOIN pg_class c ON l.relation=c.oid WHERE c.relname=\u0027relay_scopes\u0027 AND NOT l.granted",
        )
      ).rowCount
    )
      await Bun.sleep(5);
    controller.abort(new Error("Interrupted database capture"));
    expect(await settled).toBeInstanceOf(Error);
    expect(await f.list(f.backup.bucket, "complete/")).toHaveLength(0);
    expect((await catalog.readCoverage()).coverage).toEqual([]);
  } finally {
    controller.abort();
    await blocker.query("ROLLBACK");
    blocker.release();
    await worker.close();
  }
  const replacement = f.worker();
  await replacement.tick();
  expect((await catalog.readCoverage()).state).toBe("verified");
  expect(await f.pins()).toHaveLength(0);
});

test("a killed streaming process keeps pins until replacement verifies independent bytes", async () => {
  const populated = await f.populate(6 * 1024 * 1024);
  const foreign = await populated.owner.capture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
  const proxy = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url);
      const response = await fetch(endpoint + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      });
      if (request.method !== "GET" || Number(response.headers.get("content-length")) < 6 * 1024 * 1024) return response;
      const reader = response.body!.getReader();
      const first = await reader.read();
      return new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            if (first.value) controller.enqueue(first.value);
            entered.resolve();
          },
          async pull(controller) {
            await release.promise;
            const next = await reader.read();
            if (next.done) controller.close();
            else controller.enqueue(next.value);
          },
          cancel: () => reader.cancel(),
        }),
        { headers: response.headers, status: response.status },
      );
    },
  });
  const child = Bun.spawn([process.execPath, `${import.meta.dir}/backup-process.fixture.ts`], {
    env: {
      ...process.env,
      BACKUP_FIXTURE_CONFIG: JSON.stringify({
        ...f.config,
        live: { ...f.config.live, s3: { ...f.config.live.s3, endpoint: proxy.url.href } },
      }),
    },
    stdout: "ignore",
    stderr: "pipe",
  });
  try {
    await entered.promise;
    const objects = createBackupObjects(f.backup);
    const abandoned = (await objects.status())!;
    expect((await f.catalog().readCoverage()).coverage).toEqual([]);
    child.kill("SIGKILL");
    await child.exited;
    expect((await f.pins()).some((pin) => pin.id.startsWith("backup:"))).toBe(true);
    expect(await f.list(f.backup.bucket, "complete/")).toHaveLength(0);
    const replacement = f.worker();
    await replacement.tick();
    expect((await f.catalog().readCoverage()).state).toBe("verified");
    try {
      await expect(
        objects.writeStatus(abandoned.value, abandoned.etag, new AbortController().signal),
      ).rejects.toThrow();
      expect((await f.catalog().readCoverage()).state).toBe("verified");
    } finally {
      objects.close();
    }
    expect((await f.pins()).map((pin) => pin.id)).toEqual([foreign.id]);
    const uploads = await f.base.client.send(new ListMultipartUploadsCommand({ Bucket: f.backup.bucket }));
    expect(uploads.Uploads ?? []).toHaveLength(0);
    await populated.owner.releaseCapture(foreign.id);
  } finally {
    child.kill();
    await child.exited;
    release.resolve();
    await proxy.stop(true);
  }
});
