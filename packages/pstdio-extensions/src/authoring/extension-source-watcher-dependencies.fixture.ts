import { mock } from "bun:test";
import * as fs from "node:fs";
import { join } from "node:path";
import type { DirectoryWatchListener } from "../fs-watch/directory-tree-watcher";

const source = process.argv[2]!;
const dependencyRoot = join(source, "node_modules");
const scope = join(dependencyRoot, "@scope");
const pkg = join(scope, "package");
const nativeFs = { ...fs };
let packageCreated = false;

// Bun can rebuild its shared FSEvents stream while an undispatched batch is
// pending. Keep native events for source and scope setup, then drop that batch.
mock.module("node:fs", () => ({
  ...nativeFs,
  watch: (path: string, options: { recursive: boolean }, listener: DirectoryWatchListener) =>
    nativeFs.watch(path, options, (event, filename) => {
      if (!packageCreated) listener(event, filename);
    }),
}));

const { createExtensionSourceWatcher } = await import("./extension-source-watcher");
fs.mkdirSync(dependencyRoot);
let ready = false;
let packageObserved = false;
const watcher = await createExtensionSourceWatcher({
  debounceMs: 0,
  listInstalledSources: async () => [{ install_name: "source", source_path: source }],
  onSourceChanged: async () => {
    ready = true;
    if (!fs.existsSync(scope)) return;
    if (packageCreated) packageObserved = true;
    else {
      fs.mkdirSync(pkg);
      packageCreated = true;
    }
  },
});

try {
  const readyDeadline = Date.now() + 3_000;
  while (!ready && Date.now() < readyDeadline) {
    fs.writeFileSync(join(source, "watch-ready.ts"), String(Date.now()));
    await Bun.sleep(10);
  }
  if (!ready) throw new Error("The native source watcher did not become ready");
  fs.mkdirSync(scope);
  const deadline = Date.now() + 3_000;
  while (!packageObserved && Date.now() < deadline) await Bun.sleep(10);
  if (!packageCreated) throw new Error("The new scope was never reported");
  if (!packageObserved) throw new Error("The package install was missed while native notifications were unavailable");
} finally {
  watcher.dispose();
}
