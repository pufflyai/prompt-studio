import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createPreparationClient } from "pstdio-extensions/preparation-client";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

test.each([
  "initial attachment",
  "worker replacement",
])("root watching preserves a removed project during %s while watching the live home", async (phase) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "extension-root-ownership-")));
  cleanups.push(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "home");
  const project = join(root, "project");
  await mkdir(home);
  await mkdir(project);
  const homeExtensions = join(home, "extensions");
  const projectExtensions = join(project, ".pstdio", "extensions");
  const createClient = () => {
    const client = createPreparationClient(
      () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
    );
    cleanups.push(() => client.stop());
    return client;
  };
  const input = {
    id: "owned-roots",
    kind: "roots",
    rows: [
      { path: homeExtensions, ownerRoot: home },
      { path: projectExtensions, ownerRoot: project },
    ],
  };
  let client = createClient();
  if (phase === "worker replacement") {
    await client.run("watch.update", input, { home });
    expect(existsSync(homeExtensions)).toBe(true);
    expect(existsSync(projectExtensions)).toBe(true);
    await client.stop();
    client = createClient();
  }
  await rm(project, { recursive: true });
  await client.run("watch.update", input, { home });
  expect(existsSync(homeExtensions)).toBe(true);
  expect(existsSync(project)).toBe(false);
  await client.run("watch.dispose", { id: input.id }, { home });
});
