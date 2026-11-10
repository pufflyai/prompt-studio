import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { watchRecoveryFolder } from "./watch";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

test("a folder without .pstignore reports nothing but the arrival of a .pstignore", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "recovery-watch-")));
  roots.push(root);
  await mkdir(join(root, "src"));
  let changed = 0;
  let lost = 0;
  const watch = watchRecoveryFolder(
    root,
    () => changed++,
    () => lost++,
  );
  try {
    // Native watchers start asynchronously; keep writing until the first event arrives.
    const end = Date.now() + 5000;
    for (let edit = 0; !lost && Date.now() < end; edit++) {
      await writeFile(join(root, "notes"), `edit ${edit}`);
      await writeFile(join(root, "src/index.ts"), `edit ${edit}`);
      if (edit >= 3) await writeFile(join(root, ".pstignore"), "");
      await Bun.sleep(100);
    }
    expect(lost).toBeGreaterThan(0);
    expect(changed).toBe(0);
  } finally {
    watch.close();
  }
});
