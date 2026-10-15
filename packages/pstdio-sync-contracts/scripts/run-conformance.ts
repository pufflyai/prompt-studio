// Readiness is setup, outside the test bodies and their unchanged allowances.
const endpoint = process.env.SYNC_TEST_OBJECT_ENDPOINT!;
let ready = false;
for (let attempt = 0; attempt < 60; attempt++) {
  try {
    ready = (await fetch(`${endpoint}/health`)).ok;
  } catch {}
  if (ready) break;
  await Bun.sleep(500);
}
if (!ready) throw new Error("Test object storage did not become ready");
const child = Bun.spawn(
  [
    "bun",
    "test",
    process.env.SYNC_TEST_ENTRY ?? "./src/conformance/reference.integration.ts",
    ...process.argv.slice(2),
  ],
  {
    stdout: "inherit",
    stderr: "inherit",
  },
);
process.exitCode = await child.exited;

export {};
