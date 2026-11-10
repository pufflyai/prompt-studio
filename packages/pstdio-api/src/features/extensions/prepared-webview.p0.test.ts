import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createPreparationClient } from "pstdio-extensions/preparation-client";

const roots: string[] = [];
const clients: ReturnType<typeof createPreparationClient>[] = [];
const previousHome = process.env.PSTDIO_HOME;
afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

for (const batch of [false, true])
  test(`${batch ? "batch" : "single"} cached frontend preparation rejects cancellation during inspection`, async () => {
    const root = mkdtempSync(join(tmpdir(), "webview-inspection-cancellation-"));
    roots.push(root);
    process.env.PSTDIO_HOME = join(root, "home");
    const packagePath = join(root, "source");
    mkdirSync(packagePath);
    writeFileSync(join(packagePath, "package.json"), JSON.stringify({ name: "cancelled-view" }));
    const entryPath = join(packagePath, "main.ts");
    writeFileSync(entryPath, "export default { value: true };");
    const input = { packagePath, entryPath, packageName: "cancelled-view", installName: "cancelled-view" };
    const client = createPreparationClient(
      () => new Worker(new URL("./prepared-webview-cancellation.fixture.ts", import.meta.url)),
    );
    clients.push(client);
    expect(await client.run("cancel-cached-frontend", { batch, input })).toBe(
      "Cancelled while inspecting cached frontend.",
    );
  });

test("queued frontend inspection and compilation share admission and never spawn after cancellation", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-queued-cancellation-"));
  roots.push(root);
  const entryPath = join(root, "main.ts");
  writeFileSync(join(root, "package.json"), JSON.stringify({ name: "queued-view" }));
  writeFileSync(entryPath, "export default true;");
  let commands = 0;
  const client = createPreparationClient(() => {
    const worker = new Worker(new URL("./prepared-webview-cancellation.fixture.ts", import.meta.url));
    worker.on("message", (message) => {
      if (message.kind === "command") commands++;
    });
    return worker;
  });
  clients.push(client);
  expect(await client.run("queued", { queued: true, input: { packagePath: root, entryPath } })).toEqual([
    "Cancelled while waiting for a child slot.",
    "Build aborted.",
  ]);
  expect(commands).toBe(0);
});
