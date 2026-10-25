import { expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

test("ignores package directory metadata changes from recursive watchers", async () => {
  const source = mkdtempSync(join(tmpdir(), "extension-dependency-events-"));
  mkdirSync(join(source, "node_modules", "@scope", "package"), { recursive: true });
  const listeners = new Map<string, (type: string, filename: string | Buffer | null) => void>();
  let changes = 0;
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "source", source_path: source }],
    onSourceChanged: async () => {
      changes += 1;
    },
    watch: (path, listener) => {
      listeners.set(path, listener);
      return { close() {} };
    },
  });
  try {
    listeners.get(source)?.("change", join("node_modules", "@scope", "package"));
    await Bun.sleep(20);
    expect(changes).toBe(0);
    listeners.get(source)?.("rename", join("node_modules", "@scope", "package"));
    await Bun.sleep(20);
    expect(changes).toBe(1);
  } finally {
    watcher.dispose();
    rmSync(source, { recursive: true, force: true });
  }
});

test.each([true, false])("refreshes scoped package availability with an existing scope: %s", async (existingScope) => {
  const source = mkdtempSync(join(tmpdir(), "extension-dependency-watcher-"));
  const scope = join(source, "node_modules", "@scope");
  mkdirSync(existingScope ? scope : join(source, "node_modules"), { recursive: true });
  let changes = 0;
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 5,
    listInstalledSources: async () => [{ install_name: "source", source_path: source }],
    onSourceChanged: async () => {
      changes += 1;
    },
  });
  const expectChange = async (operation: () => void) => {
    const before = changes;
    operation();
    const deadline = Date.now() + 1000;
    while (changes === before && Date.now() < deadline) await Bun.sleep(10);
    expect(changes).toBeGreaterThan(before);
  };
  try {
    // Wait for native events before testing dependency changes; watch registration is asynchronous on macOS.
    const readyDeadline = Date.now() + 1000;
    while (changes === 0 && Date.now() < readyDeadline) {
      writeFileSync(join(source, "watch-ready.ts"), String(Date.now()));
      await Bun.sleep(10);
    }
    expect(changes).toBeGreaterThan(0);
    if (!existingScope) await expectChange(() => mkdirSync(scope));
    const pkg = join(scope, "package");
    await expectChange(() => mkdirSync(pkg));
    await expectChange(() => rmSync(pkg, { recursive: true }));
  } finally {
    watcher.dispose();
    rmSync(source, { recursive: true, force: true });
  }
});

test("observes a package installed immediately after its new scope is detected", async () => {
  const source = mkdtempSync(join(tmpdir(), "extension-scope-registration-"));
  const scope = join(source, "node_modules", "@scope");
  const pkg = join(scope, "package");
  mkdirSync(join(source, "node_modules"));
  let ready = false;
  let packageObserved = false;
  const watcher = await createExtensionSourceWatcher({
    debounceMs: 0,
    listInstalledSources: async () => [{ install_name: "source", source_path: source }],
    onSourceChanged: async () => {
      ready = true;
      if (!existsSync(scope)) return;
      if (!existsSync(pkg)) mkdirSync(pkg);
      else packageObserved = true;
    },
  });
  try {
    const readyDeadline = Date.now() + 1000;
    while (!ready && Date.now() < readyDeadline) {
      writeFileSync(join(source, "watch-ready.ts"), String(Date.now()));
      await Bun.sleep(10);
    }
    expect(ready).toBe(true);
    mkdirSync(scope);
    const deadline = Date.now() + 1000;
    while (!packageObserved && Date.now() < deadline) await Bun.sleep(10);
    expect(packageObserved).toBe(true);
  } finally {
    watcher.dispose();
    rmSync(source, { recursive: true, force: true });
  }
});
