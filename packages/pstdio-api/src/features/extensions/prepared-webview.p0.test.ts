import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { stopExtensionPreparation } from "pstdio-extensions";
import { createPreparationClient } from "pstdio-extensions/preparation-client";

const roots: string[] = [];
const clients: ReturnType<typeof createPreparationClient>[] = [];
const previousHome = process.env.PSTDIO_HOME;
afterEach(async () => {
  for (const client of clients.splice(0)) await client.stop();
  await stopExtensionPreparation();
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

test("batch frontend preparation retains the actionable missing-dependency diagnostic", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-batch-missing-dependency-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "missing-view", dependencies: { "missing-view-dependency": "1.0.0" } }),
  );
  const entryPath = join(root, "main.ts");
  writeFileSync(entryPath, 'import "missing-view-dependency"; export default true;');
  const { prepareWebviewArtifacts } = await import("./prepared-webview");
  await expect(
    prepareWebviewArtifacts(
      [{ packagePath: root, entryPath, packageName: "missing-view", installName: "missing-view" }],
      new AbortController().signal,
    ),
  ).rejects.toThrow(`Missing extension webview dependencies: missing-view-dependency. Run \`bun install\` in ${root}.`);
});

test("batch frontend preparation uses selected repository dependencies and refreshes after their bytes change", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-repository-dependencies-"));
  roots.push(root);
  const previousCwd = process.cwd();
  process.env.PSTDIO_HOME = join(root, "home");
  const packagePath = join(root, "installed");
  const fallback = join(root, "extensions", "repository-view");
  const dependency = join(fallback, "node_modules", "repository-view-dependency");
  mkdirSync(packagePath);
  mkdirSync(dependency, { recursive: true });
  const manifest = { name: "repository-view", dependencies: { "repository-view-dependency": "1.0.0" } };
  for (const path of [packagePath, fallback]) writeFileSync(join(path, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "repository-view-dependency", main: "index.js" }),
  );
  writeFileSync(join(dependency, "index.js"), 'export const value = "first fallback bytes";');
  const entryPath = join(packagePath, "main.ts");
  writeFileSync(entryPath, 'import {value} from "repository-view-dependency"; export default value;');
  const input = { packagePath, entryPath, packageName: manifest.name, installName: manifest.name };
  try {
    process.chdir(root);
    const { prepareWebviewArtifact, prepareWebviewArtifacts } = await import("./prepared-webview");
    const signal = new AbortController().signal;
    const single = await prepareWebviewArtifact(input, signal);
    expect(await Bun.file(join(single.distDir, "module.js")).text()).toContain("first fallback bytes");
    process.env.PSTDIO_HOME = join(root, "batch-home");
    const [first] = await prepareWebviewArtifacts([input], signal);
    expect(await Bun.file(join(first!.distDir, "module.js")).text()).toContain("first fallback bytes");
    expect((await prepareWebviewArtifacts([input], signal))[0]!.id).toBe(first!.id);
    writeFileSync(join(dependency, "index.js"), 'export const value = "second fallback bytes";');
    const [second] = await prepareWebviewArtifacts([input], signal);
    expect(second!.id).not.toBe(first!.id);
    expect(await Bun.file(join(second!.distDir, "module.js")).text()).toContain("second fallback bytes");
    const refreshedSingle = await prepareWebviewArtifact(input, signal);
    expect(refreshedSingle.id).not.toBe(single.id);
    expect(await Bun.file(join(refreshedSingle.distDir, "module.js")).text()).toContain("second fallback bytes");
  } finally {
    process.chdir(previousCwd);
  }
});
