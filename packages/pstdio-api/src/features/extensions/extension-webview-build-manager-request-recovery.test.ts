import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import type { ExtensionWebviewBuildResult } from "./extension-webview-builder";

const webviewIds = ["pstdio.lab.view.labPage", "pstdio.lab.view.timeline"];
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const setup = (build: (entryPath: string) => ExtensionWebviewBuildResult | Promise<ExtensionWebviewBuildResult>) => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-webview-request-recovery-test-"));
  roots.push(root);
  const sourcePath = join(root, "extension");
  const cacheRoot = join(root, "cache");
  mkdirSync(join(sourcePath, "src"), { recursive: true });
  writeFileSync(
    join(sourcePath, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(sourcePath, "src/main.tsx"), "console.log('main');");
  writeFileSync(join(sourcePath, "src/timeline.tsx"), "console.log('timeline');");
  writeFileSync(
    join(sourcePath, "extension.ts"),
    `export default {
      views: [
        { id: "labPage", title: "Lab", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } } },
        { id: "timeline", title: "Timeline", body: { kind: "webview", entry: { kind: "package-asset", path: "./src/timeline.tsx", baseUrl: import.meta.url } } },
      ],
    };`,
  );
  const builds: string[] = [];
  const failures: string[] = [];
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [
      {
        updated_at: "2026-10-16T00:00:00.000Z",

        id: "installed-lab",
        install_name: "extension-lab",
        source_hash: "hash-1",
        source_path: sourcePath,
      },
    ],
    reportBuildFailure: async (_installedExtensionId, webviewId) => {
      failures.push(webviewId);
      return "reported";
    },
    reportBuildSuccess: async () => {
      return "reported";
    },
    buildWebview: async (input) => {
      builds.push(input.entryPath);
      const result = await build(input.entryPath);
      if (!result.success) return result;
      mkdirSync(input.outdir, { recursive: true });
      writeFileSync(join(input.outdir, "module.js"), readFileSync(input.entryPath, "utf8"));
      return result;
    },
    webviewCacheRoot: cacheRoot,
  });
  const dist = (webviewId: string) => join(cacheRoot, "installed-lab", webviewId, "dist");
  return { builds, dist, failures, manager, sourcePath };
};

const built = { success: true, details: "" };

describe("createExtensionWebviewBuildManager request recovery", () => {
  test("rebuilds a missing published webview when an asset request names it", async () => {
    const fixture = setup(() => built);
    try {
      await fixture.manager.ensure("installed-lab", webviewIds[1]);
      rmSync(fixture.dist(webviewIds[1]), { recursive: true, force: true });

      await fixture.manager.ensure("installed-lab", webviewIds[1]);

      expect(fixture.builds).toHaveLength(3);
      expect(existsSync(join(fixture.dist(webviewIds[1]), "module.js"))).toBe(true);
      expect(existsSync(join(fixture.dist(webviewIds[0]), "module.js"))).toBe(true);
    } finally {
      fixture.manager.dispose();
    }
  });

  test("rebuilds a published webview whose module is missing while its signature remains", async () => {
    const fixture = setup(() => built);
    try {
      await fixture.manager.ensure("installed-lab", webviewIds[1]);
      rmSync(join(fixture.dist(webviewIds[1]), "module.js"));

      await Promise.all([
        fixture.manager.ensure("installed-lab", webviewIds[1]),
        fixture.manager.ensure("installed-lab", webviewIds[1]),
      ]);

      expect(fixture.builds).toHaveLength(3);
      expect(readFileSync(join(fixture.dist(webviewIds[1]), "module.js"), "utf8")).toBe("console.log('timeline');");
    } finally {
      fixture.manager.dispose();
    }
  });

  test("keeps a failed build blocked for asset requests until its inputs change", async () => {
    const fixture = setup((entryPath) =>
      entryPath.endsWith("timeline.tsx") ? { success: false, details: "Could not resolve" } : built,
    );
    try {
      await fixture.manager.ensure("installed-lab", webviewIds[1]);
      await fixture.manager.ensure("installed-lab", webviewIds[1]);

      expect(fixture.builds.filter((entryPath) => entryPath.endsWith("timeline.tsx"))).toHaveLength(1);
      expect(fixture.failures).toEqual([webviewIds[1]]);
      expect(existsSync(join(fixture.dist(webviewIds[0]), "module.js"))).toBe(true);
    } finally {
      fixture.manager.dispose();
    }
  });

  test("builds a failed webview again when its source is refreshed, even with unchanged inputs", async () => {
    let timelineAttempts = 0;
    const fixture = setup((entryPath) => {
      if (!entryPath.endsWith("timeline.tsx")) return built;
      timelineAttempts++;
      return timelineAttempts === 1 ? { success: false, details: "Build process stopped" } : built;
    });
    try {
      await fixture.manager.ensure("installed-lab", webviewIds[1]);

      await fixture.manager.refresh(fixture.sourcePath);

      expect(timelineAttempts).toBe(2);
      expect(existsSync(join(fixture.dist(webviewIds[1]), "module.js"))).toBe(true);
    } finally {
      fixture.manager.dispose();
    }
  });
});
