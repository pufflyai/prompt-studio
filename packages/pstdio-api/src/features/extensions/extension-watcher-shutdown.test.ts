import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionRootWatcher } from "./extension-root-watcher";
import { createExtensionSourceWatcher } from "./extension-source-watcher";

for (const kind of ["root", "source"] as const) {
  test(`${kind} watcher cannot reopen handles after a pending discovery is disposed`, async () => {
    const root = mkdtempSync(join(tmpdir(), "extension-shutdown-"));
    const discovery = Promise.withResolvers<void>();
    let calls = 0;
    let watched = 0;
    const watch = () => {
      watched++;
      return { close() {} };
    };
    const wait = async () => {
      if (++calls > 1) await discovery.promise;
    };
    const watcher =
      kind === "root"
        ? await createExtensionRootWatcher({
            listExtensionRoots: async () => {
              await wait();
              return calls === 1 ? [] : [{ path: root, sync: async () => {} }];
            },
            watch,
          })
        : await createExtensionSourceWatcher({
            listInstalledSources: async () => {
              await wait();
              return calls === 1 ? [] : [{ install_name: "test", source_path: root }];
            },
            onSourceChanged: async () => {},
            watch,
          });
    try {
      const refreshing = watcher.refresh();
      watcher.dispose();
      discovery.resolve();
      await refreshing;
      expect(watched).toBe(0);
    } finally {
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

for (const focused of [false, true]) {
  test(`source watcher stays closed when disposed during source replacement (focused: ${focused})`, async () => {
    const root = mkdtempSync(join(tmpdir(), "extension-replacement-shutdown-"));
    const source = join(root, "source");
    mkdirSync(source);
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let watched = 0;
    let closed = 0;
    const watcher = await createExtensionSourceWatcher({
      listInstalledSources: async () => [{ install_name: "test", source_path: source }],
      onSourceChanged: async () => {
        entered.resolve();
        await release.promise;
      },
      watch: () => {
        watched++;
        return {
          close() {
            closed++;
          },
        };
      },
    });
    try {
      renameSync(source, join(root, "previous"));
      mkdirSync(source);
      const refreshing = watcher.refresh(focused ? source : undefined);
      await entered.promise;
      watcher.dispose();
      release.resolve();
      await refreshing;
      expect(watched).toBe(2);
      expect(closed).toBe(watched);
    } finally {
      release.resolve();
      watcher.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
}
