import { Client } from "pg";
import { conformanceFiles } from "./conformance-files";

// Readiness is setup, outside the test bodies and their unchanged allowances.
const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
let ready = false;
let lastResult = "no response";
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    const response = await fetch(`${endpoint}/health`);
    ready = response.ok;
    lastResult = `HTTP ${response.status} ${(await response.text()).trim()}`;
  } catch (error) {
    lastResult = error instanceof Error ? error.message : String(error);
  }
  if (ready) break;
  await Bun.sleep(500);
}
if (!ready) throw new Error(`Test object storage at ${endpoint} did not become ready. Last result: ${lastResult}`);
console.log(`Test object storage ready at ${endpoint}`);

const files = conformanceFiles(process.argv.slice(2), (process.env.TEST_PRIORITIES ?? "P1").split(","));
const admin = new Client({ connectionString: process.env.SYNC_TEST_DATABASE_URL });
await admin.connect();
const failed: string[] = [];
try {
  for (const file of files) {
    const name = `conformance_${crypto.randomUUID().replaceAll("-", "")}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = new URL(process.env.SYNC_TEST_DATABASE_URL!);
    url.pathname = `/${name}`;
    try {
      const child = Bun.spawn(["bun", "test", file, ...(process.env.CI_PRIORITY === "P1" ? ["--bail=1"] : [])], {
        env: { ...process.env, SYNC_TEST_DATABASE_URL: url.toString() },
        stdout: "inherit",
        stderr: "inherit",
      });
      if (await child.exited) {
        failed.push(file);
        if (process.env.CI_PRIORITY === "P1") break;
      }
    } finally {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    }
  }
} finally {
  await admin.end();
}
for (const file of failed) console.error(`Conformance failed: ${file}`);
process.exitCode = failed.length ? 1 : 0;
