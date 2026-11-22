import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { createPreparationClient } from "pstdio-extensions/preparation-client";

test("removes watched source bytes on the preparation worker without inspecting a partial tree", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "source-removal-")));
  const sourcePath = join(root, ".pstdio/extensions/removed");
  const otherPath = join(root, ".pstdio/extensions/remaining");
  const client = createPreparationClient(
    () => new Worker(new URL("./extension-preparation-worker.ts", import.meta.url)),
    undefined,
    { workers: 4 },
  );
  const options = { home: join(root, "home") };
  try {
    for (const path of [sourcePath, otherPath]) {
      await mkdir(join(path, "nested"), { recursive: true });
      await writeFile(join(path, "extension.ts"), "export default {};");
      await writeFile(join(path, "nested/child.ts"), "export const child = true;");
    }
    const errors: unknown[] = [];
    const remainingChanged = Promise.withResolvers<void>();
    client.subscribe((event) => {
      if (event.error) errors.push(event.error);
      if (event.sourcePath === otherPath && !event.attachment) remainingChanged.resolve();
    });
    await client.run(
      "watch.update",
      {
        id: "removal",
        kind: "sources",
        rows: [sourcePath, otherPath].map((source_path) => ({ source_path, install_name: source_path })),
      },
      options,
    );
    await writeFile(join(sourcePath, "extension.ts"), "export default { changed: true };");
    await client.run("source.remove", { sourcePath }, options);
    expect(existsSync(sourcePath)).toBe(false);
    await writeFile(join(otherPath, "extension.ts"), "export default { changed: true };");
    await remainingChanged.promise;
    expect(errors).toEqual([]);
    // An external source stays on disk when only its installation is removed.
    const external = join(root, "external");
    await mkdir(external);
    await client.run("source.remove", { sourcePath: external }, options);
    expect(existsSync(external)).toBe(true);
  } finally {
    await client.stop();
    await rm(root, { recursive: true, force: true });
  }
});
