import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { buildExtensionWebview } from "./extension-webview-builder";
import { writeExtension } from "./test-utils/webview-build-fixture";
import { setup } from "./test-utils/webview-failure-fixture";

test("retries a repaired cache's unwritten result without rebuilding", async () => {
  const fixture = await setup();
  try {
    await fixture.manager.ensure(fixture.id, "pstdio.lab.view.page");
    const revision = (await fixture.sources.get(fixture.id))?.loaded_revision;
    rmSync(join(fixture.sourcePath, "..", "cache", fixture.id, "pstdio.lab.view.page", "dist"), {
      recursive: true,
      force: true,
    });
    fixture.setReportingUnavailable(true);

    await expect(fixture.manager.ensure(fixture.id, "pstdio.lab.view.page")).rejects.toThrow(
      "Could not record webview build result",
    );
    expect(fixture.state.builds).toBe(2);
    expect((await fixture.sources.get(fixture.id))?.loaded_revision).toBe(revision);

    fixture.setReportingUnavailable(false);
    await fixture.manager.ensure(fixture.id, "pstdio.lab.view.page");

    expect((await fixture.sources.get(fixture.id))?.loaded_revision).not.toBe(revision);
    expect(fixture.state.builds).toBe(2);
  } finally {
    await fixture.dispose();
  }
});

test("keeps requests waiting for a sibling build after failure reporting fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "webview-persistence-siblings-"));
  const sourcePath = join(root, "extension");
  writeExtension(sourcePath, { first: "src/first.tsx", second: "src/second.tsx" });
  writeFileSync(join(sourcePath, "src/first.tsx"), "export const broken = ;");
  const reporting = Promise.withResolvers<void>();
  const siblingBuilt = Promise.withResolvers<void>();
  const releaseSibling = Promise.withResolvers<void>();
  let unavailable = true;
  let siblingBuilds = 0;
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      {
        updated_at: "2026-10-16T00:00:00.000Z",

        id: "lab",
        install_name: "lab",
        source_path: sourcePath,
      },
    ],
    reportBuildFailure: async () => {
      if (unavailable) {
        reporting.resolve();
        throw new Error("Failure storage unavailable");
      }
      return "reported";
    },
    reportBuildSuccess: async () => {
      return "reported";
    },
    buildWebview: async (input) => {
      const result = await buildExtensionWebview(input);
      if (input.entryPath.endsWith("second.tsx")) {
        siblingBuilds++;
        siblingBuilt.resolve();
        await releaseSibling.promise;
      }
      return result;
    },
    webviewCacheRoot: join(root, "cache"),
  });
  const initial = manager.ensure("lab").catch((error: unknown) => error);
  try {
    await Promise.all([reporting.promise, siblingBuilt.promise]);
    await Bun.sleep(0);
    unavailable = false;
    let completed = false;
    const request = manager
      .ensure("lab", "pstdio.lab.view.second")
      .finally(() => {
        completed = true;
      })
      .catch((error: unknown) => error);
    await Bun.sleep(0);
    const completedBeforeSibling = completed;
    releaseSibling.resolve();
    await Promise.all([initial, request]);
    expect(completedBeforeSibling).toBe(false);
    expect(siblingBuilds).toBe(1);
  } finally {
    releaseSibling.resolve();
    await initial;
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});
