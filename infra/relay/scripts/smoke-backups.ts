import { strict as assert } from "node:assert";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { type AssetConfig, createRelayBackupCatalog, createRelayBackupWorker } from "../src/index";

export const checkBuiltBackups = async (live: AssetConfig) => {
  const bucket = `backup-smoke-${crypto.randomUUID()}`;
  const client = new S3Client(live.s3);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  const backup = { bucket, s3: live.s3 };
  const worker = createRelayBackupWorker({ databaseUrl: live.databaseUrl, live, backup });
  const catalog = createRelayBackupCatalog(backup);
  try {
    await worker.tick();
    const verified = await catalog.readCoverage();
    assert.equal(verified.state, "verified");
    assert.ok(verified.coverage.length > 0);
    const denied = await fetch(`${process.env.S3_ENDPOINT}/${bucket}/${verified.backup!.key}`);
    assert.equal(denied.status, 403);
  } finally {
    await worker.close();
    catalog.close();
    client.destroy();
  }
  const child = Bun.spawn([process.execPath, "/app/backup-server.js"], {
    env: {
      PATH: process.env.PATH!,
      NO_PROXY: "objects,postgres,localhost,127.0.0.1",
      no_proxy: "objects,postgres,localhost,127.0.0.1",
      DATABASE_URL: live.databaseUrl,
      S3_BUCKET: live.bucket,
      S3_ENDPOINT: process.env.S3_ENDPOINT!,
      S3_REGION: process.env.S3_REGION!,
      S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
      S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
      BACKUP_S3_BUCKET: bucket,
      BACKUP_S3_ENDPOINT: process.env.S3_ENDPOINT!,
      BACKUP_S3_REGION: process.env.S3_REGION!,
      BACKUP_S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID!,
      BACKUP_S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY!,
      RELAY_BACKUP_HOST: "127.0.0.1",
      RELAY_BACKUP_PORT: "0",
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const reader = child.stdout.getReader();
  try {
    let text = "";
    while (!text.includes("\n")) {
      const next = await reader.read();
      if (next.done) throw new Error("Built backup scheduler exited before listening");
      text += new TextDecoder().decode(next.value);
    }
    const ready = JSON.parse(text.split("\n")[0]!);
    assert.equal((await fetch(new URL("/health", ready.url))).status, 200);
    child.kill("SIGTERM");
    assert.equal(await child.exited, 0);
  } finally {
    child.kill();
    await child.exited;
    reader.releaseLock();
  }
  console.log("Built private hourly backup capture, verified coverage and scheduler shutdown passed");
};
