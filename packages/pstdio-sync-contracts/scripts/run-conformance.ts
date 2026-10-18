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
