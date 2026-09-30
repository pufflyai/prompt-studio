import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { extensionWebviewBuildOptions } from "./extension-webview-builder";

const writeExtension = (root: string) => {
  mkdirSync(join(root, "src"), { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "lab",
      version: "1.0.0",
      displayName: "Lab",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(join(root, "src/main.tsx"), "console.log('webview');");
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      views: [{
        id: "labPage",
        title: "Lab",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } },
      }],
    };`,
  );
};

const setup = () => {
  const root = mkdtempSync(join(tmpdir(), "webview-usage-"));
  const sourcePath = join(root, "extension");
  const unusedPath = join(root, "unused");
  writeExtension(sourcePath);
  writeExtension(unusedPath);
  const builds: string[] = [];
  const managers: ReturnType<typeof createExtensionWebviewBuildManager>[] = [];
  const dist = join(root, "cache/installed-lab/pstdio.lab.view.labPage/dist");
  const createManager = () => {
    const manager = createExtensionWebviewBuildManager({
      listInstalledSources: async () => [
        { id: "installed-lab", install_name: "extension-lab", source_path: sourcePath },
        { id: "unused", install_name: "unused", source_path: unusedPath },
      ],
      reportBuildFailure: async (_name, _id, error) => {
        throw error;
      },
      reportBuildSuccess: async () => {},
      buildWebview: async ({ outdir, entryPath }) => {
        builds.push(entryPath);
        mkdirSync(outdir, { recursive: true });
        writeFileSync(join(outdir, "module.js"), readFileSync(entryPath));
        return { success: true, details: "" };
      },
      webviewCacheRoot: join(root, "cache"),
    });
    managers.push(manager);
    return manager;
  };
  return {
    root,
    sourcePath,
    unusedPath,
    builds,
    dist,
    createManager,
    dispose: () => {
      for (const manager of managers) manager.dispose();
      rmSync(root, { recursive: true, force: true });
    },
  };
};

describe("webview build usage", () => {
  test("reuses published bundles across manager restarts", async () => {
    const fixture = setup();
    try {
      const first = fixture.createManager();
      await first.ensure("installed-lab");
      first.dispose();
      await fixture.createManager().ensure("installed-lab");
      expect(fixture.builds).toHaveLength(1);
      expect(readFileSync(join(fixture.dist, "build-signature.txt"), "utf8")).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      fixture.dispose();
    }
  });

  test("rebuilds edits made while the runtime was closed", async () => {
    const fixture = setup();
    try {
      const first = fixture.createManager();
      await first.ensure("installed-lab");
      first.dispose();
      writeFileSync(join(fixture.sourcePath, "src/main.tsx"), "export default 2;");
      await fixture.createManager().ensure("installed-lab");
      expect(fixture.builds).toHaveLength(2);
      expect(readFileSync(join(fixture.dist, "module.js"), "utf8")).toBe("export default 2;");
    } finally {
      fixture.dispose();
    }
  });

  test("builds only used extensions and shares concurrent usage checks", async () => {
    const fixture = setup();
    try {
      const manager = fixture.createManager();
      await manager.refresh();
      expect(fixture.builds).toHaveLength(0);
      await Promise.all([manager.ensure("installed-lab"), manager.ensure("installed-lab")]);
      await manager.ensure("installed-lab");
      expect(fixture.builds).toEqual([join(fixture.sourcePath, "src/main.tsx")]);
    } finally {
      fixture.dispose();
    }
  });

  test("watcher changes build used extensions immediately and defer unused extensions", async () => {
    const fixture = setup();
    try {
      const manager = fixture.createManager();
      await manager.ensure("installed-lab");
      writeFileSync(join(fixture.sourcePath, "src/main.tsx"), "export default 2;");
      writeFileSync(join(fixture.unusedPath, "src/main.tsx"), "export default 3;");
      await manager.refresh(fixture.sourcePath);
      await manager.refresh(fixture.unusedPath);
      expect(fixture.builds).toHaveLength(2);
      await manager.ensure("unused");
      expect(fixture.builds).toHaveLength(3);
    } finally {
      fixture.dispose();
    }
  });

  test("rebuilds once when host builder options change", async () => {
    const fixture = setup();
    const define = extensionWebviewBuildOptions.define["process.env.NODE_ENV"];
    try {
      const first = fixture.createManager();
      await first.ensure("installed-lab");
      first.dispose();
      extensionWebviewBuildOptions.define["process.env.NODE_ENV"] = '"development"';
      const second = fixture.createManager();
      await second.ensure("installed-lab");
      second.dispose();
      await fixture.createManager().ensure("installed-lab");
      expect(fixture.builds).toHaveLength(2);
    } finally {
      extensionWebviewBuildOptions.define["process.env.NODE_ENV"] = define;
      fixture.dispose();
    }
  });

  test("removes staging folders left by interrupted builds", async () => {
    const fixture = setup();
    try {
      const parent = join(fixture.dist, "..");
      mkdirSync(join(parent, "dist.staging-interrupted"), { recursive: true });
      mkdirSync(join(parent, "source.staging-interrupted"), { recursive: true });
      await fixture.createManager().ensure("installed-lab");
      expect(existsSync(join(parent, "dist.staging-interrupted"))).toBe(false);
      expect(existsSync(join(parent, "source.staging-interrupted"))).toBe(false);
      expect(existsSync(join(fixture.dist, "module.js"))).toBe(true);
    } finally {
      fixture.dispose();
    }
  });
});
