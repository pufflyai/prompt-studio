import { strict as assert } from "node:assert";
import { S3Client, SQL } from "bun";

const response = await fetch(`${process.env.RELAY_URL}/health`);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { status: "ok" });
console.log("Built relay liveness passed");

const sql = new SQL(process.env.DATABASE_URL!);
try {
  await sql`CREATE TEMP TABLE smoke (value TEXT NOT NULL)`;
  await sql`INSERT INTO smoke VALUES (${"relay-smoke"})`;
  const rows = await sql`SELECT value FROM smoke`;
  assert.equal(rows[0].value, "relay-smoke");
  console.log("Disposable PostgreSQL round trip passed");
} finally {
  await sql.close();
}

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  bucket: process.env.S3_BUCKET,
  region: process.env.S3_REGION,
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  virtualHostedStyle: false,
});
const key = `smoke/${crypto.randomUUID()}`;
const bytes = crypto.getRandomValues(new Uint8Array(1024));
try {
  await s3.write(key, bytes);
  assert.equal(await s3.exists(key), true);
  assert.deepEqual(new Uint8Array(await s3.file(key).arrayBuffer()), bytes);
} finally {
  await s3.delete(key);
}
assert.equal(await s3.exists(key), false);
console.log("Disposable S3 byte round trip and deletion passed");
