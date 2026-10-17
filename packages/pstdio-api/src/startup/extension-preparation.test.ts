import { expect, test } from "bun:test";
import { runStartupTasks } from ".";

test("runtime readiness does not wait for legacy extension preparation and tracks its completion", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const background: Promise<void>[] = [];
  const deps = {
    installedExtensionSourcesService: {
      list: async () => {
        entered.resolve();
        await release.promise;
        return [];
      },
    },
    projectService: { list: async () => [] },
    sessionService: { listActive: async () => [] },
  } as unknown as Parameters<typeof runStartupTasks>[0];
  let ready = false;
  const readiness = runStartupTasks(deps, undefined, {
    prepareDefaultExtensions: async () => {},
    onBackgroundTask: (task) => {
      background.push(task);
    },
  }).then(() => {
    ready = true;
  });
  try {
    await entered.promise;
    await Bun.sleep(0);
    expect(ready).toBe(true);
    let prepared = false;
    void Promise.all(background).then(() => {
      prepared = true;
    });
    await Bun.sleep(0);
    expect(prepared).toBe(false);
  } finally {
    release.resolve();
    await readiness;
    await Promise.all(background);
  }
});
