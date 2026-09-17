import { strict as assert } from "node:assert";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

const [mode, source] = process.argv.slice(2);
const dependencyRoot = join(source, "node_modules");
const packagePath = join(dependencyRoot, "@scope", "package");

if (mode === "remove") {
  for (let iteration = 0; iteration < 1000; iteration += 1) {
    mkdirSync(packagePath, { recursive: true });
    rmSync(dependencyRoot, { recursive: true, force: true });
  }
} else {
  let changes = 0;
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "source", source_path: source }],
    onSourceChanged: async () => {
      changes += 1;
    },
  });
  try {
    // Removal runs in another process so it can overlap a synchronous directory read.
    const removal = Bun.spawn([process.execPath, import.meta.filename, "remove", source], {
      stdout: "inherit",
      stderr: "inherit",
    });
    assert.equal(await removal.exited, 0);
    await Bun.sleep(20);
    const before = changes;
    mkdirSync(packagePath, { recursive: true });
    const deadline = Date.now() + 1000;
    while (changes === before && Date.now() < deadline) await Bun.sleep(10);
    assert.ok(changes > before, "Dependency changes must still refresh the source after removal");
  } finally {
    watcher.dispose();
  }
}
