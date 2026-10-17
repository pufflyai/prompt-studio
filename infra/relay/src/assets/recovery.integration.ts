import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { SQL } from "bun";
import { fingerprint, type Scope } from "pstdio-sync-contracts";
import { createAssetFixture, input, newScope, reference } from "./integration-fixture";

const fixture = createAssetFixture();
const assets = fixture.owner();
const root = await mkdtemp(join(tmpdir(), "relay-assets-"));
const entry = join(root, "upload.js");
beforeAll(async () => {
  await fixture.initialize();
  const bundle = await Bun.build({
    entrypoints: [resolve(import.meta.dir, "upload-process.fixture.ts")],
    target: "bun",
  });
  if (!bundle.success) throw new AggregateError(bundle.logs, "Could not build asset process fixture");
  await Bun.write(entry, bundle.outputs[0]!);
});
afterAll(async () => {
  await assets.close();
  fixture.close();
  await rm(root, { recursive: true, force: true });
});
const spawn = (scope: Scope, action: string) =>
  Bun.spawn(["bun", entry], {
    env: {
      ...process.env,
      RELAY_ASSET_TEST_CONFIG: JSON.stringify(fixture.config),
      RELAY_ASSET_TEST_SCOPE: JSON.stringify(scope),
      RELAY_ASSET_TEST_ACTION: action,
    },
    stdout: "pipe",
    stderr: "inherit",
  });

test("a killed process leaves acknowledged parts available to a new owner", async () => {
  const scope = newScope();
  const child = spawn(scope, "part");
  const reader = child.stdout.getReader();
  try {
    let output = "";
    while (!output.includes("part committed")) {
      const chunk = await reader.read();
      if (chunk.done) throw new Error("Upload process exited before committing its part");
      output += new TextDecoder().decode(chunk.value);
    }
    child.kill("SIGKILL");
    await child.exited;
    const bytes = new Uint8Array(5 * 1024 * 1024 + 32).fill(9);
    const asset = reference(bytes);
    const resumed = await assets.begin(scope, "crash-part", asset);
    expect(resumed.parts).toHaveLength(1);
    expect(resumed.parts[0].etag).toBeTruthy();
    expect(await assets.complete(scope, asset)).toBe(false);
    await assets.writePart(scope, "crash-part", 2, input(bytes.subarray(resumed.partSize)));
    expect(await assets.finish(scope, "crash-part")).toEqual(asset);
    expect(await assets.complete(scope, asset)).toBe(true);
  } finally {
    child.kill("SIGKILL");
    await child.exited;
    reader.releaseLock();
  }
});

test("a crash after S3 completion rolls back metadata and recovers by verifying durable bytes", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("complete object before metadata");
  const asset = reference(bytes);
  await assets.begin(scope, "crash-finish", asset);
  await assets.writePart(scope, "crash-finish", 1, input(bytes));
  const sql = new SQL(fixture.config.databaseUrl);
  const lock = await sql.reserve();
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await sql`CREATE FUNCTION relay_asset_block_commit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN PERFORM pg_advisory_xact_lock(760); RETURN NEW; END
    $$`;
    await sql`CREATE TRIGGER relay_asset_block_commit BEFORE INSERT ON relay_verified_assets
      FOR EACH ROW EXECUTE FUNCTION relay_asset_block_commit()`;
    await lock`SELECT pg_advisory_lock(760)`;
    child = spawn(scope, "finish");
    let blocked = false;
    while (!blocked) {
      const rows = await sql`SELECT 1 FROM pg_stat_activity WHERE datname = current_database()
        AND wait_event = 'advisory' AND query LIKE '%relay_verified_assets%'`;
      blocked = rows.length > 0;
      if (child.exitCode !== null) throw new Error("Upload process exited before the metadata commit boundary");
      if (!blocked) await Bun.sleep(10);
    }
    const key = `assets/${await fingerprint(scope)}/${await fingerprint("crash-finish")}`;
    const durable = await fixture.client.send(new HeadObjectCommand({ Bucket: fixture.config.bucket, Key: key }));
    expect(durable.ContentLength).toBe(asset.byteLength);
    expect(await assets.complete(scope, asset)).toBe(false);
    child.kill("SIGKILL");
    await child.exited;
    await lock`SELECT pg_advisory_unlock(760)`;
    expect(await assets.finish(scope, "crash-finish")).toEqual(asset);
    expect(await assets.complete(scope, asset)).toBe(true);
    expect(await assets.finish(scope, "crash-finish")).toEqual(asset);
  } finally {
    child?.kill("SIGKILL");
    await child?.exited;
    await lock`SELECT pg_advisory_unlock_all()`;
    lock.release();
    await sql`DROP TRIGGER IF EXISTS relay_asset_block_commit ON relay_verified_assets`;
    await sql`DROP FUNCTION IF EXISTS relay_asset_block_commit()`;
    await sql.close();
  }
});

test("lost object completion acknowledgment is recovered without uploading bytes again", async () => {
  const scope = newScope();
  const bytes = new TextEncoder().encode("lost complete response");
  const asset = reference(bytes);
  let lost = false;
  let partWrites = 0;
  const proxy = fixture.proxy(async (request, response) => {
    const url = new URL(request.url);
    if (request.method === "PUT" && url.searchParams.has("partNumber")) partWrites++;
    if (request.method === "POST" && url.searchParams.has("uploadId") && !lost) {
      lost = true;
      await response.arrayBuffer();
      return new Response("Lost complete acknowledgment", { status: 502 });
    }
    return response;
  });
  try {
    await proxy.owner.begin(scope, "lost-complete", asset);
    await proxy.owner.writePart(scope, "lost-complete", 1, input(bytes));
    await expect(proxy.owner.finish(scope, "lost-complete")).rejects.toThrow();
    expect(lost).toBe(true);
    expect(await proxy.owner.complete(scope, asset)).toBe(false);
    expect(await proxy.owner.finish(scope, "lost-complete")).toEqual(asset);
    expect(partWrites).toBe(1);
    expect(await proxy.owner.complete(scope, asset)).toBe(true);
  } finally {
    await proxy.owner.close();
    await proxy.close();
  }
});
