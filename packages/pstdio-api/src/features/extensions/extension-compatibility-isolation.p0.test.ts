import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { createProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import { writeExtension, writeManagedBuildOutput } from "./test-utils/webview-build-fixture";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "pstdio-compatibility-isolation-"));
  const paths = [join(root, "healthy"), join(root, "incompatible")];
  const setRange = (range: string) => {
    const path = join(paths[1]!, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    writeFileSync(path, JSON.stringify({ ...manifest, engines: { pstdio: range } }));
  };
  for (const [index, path] of paths.entries()) {
    writeExtension(path, { labPage: "src/main.tsx" });
    writeFileSync(
      join(path, "extension.ts"),
      `export default {
      views: [{ id: "labPage", ref: { kind: "view", id: "labPage" }, title: "Lab",
        body: { kind: "webview", entry: { kind: "package-asset", path: "./src/main.tsx", baseUrl: import.meta.url } } }],
    };`,
    );
    const manifest = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
    writeFileSync(join(path, "package.json"), JSON.stringify({ ...manifest, name: `lab-${index}` }));
  }
  setRange("^0.3.0");
  return {
    root,
    paths,
    setRange,
    rows: paths.map((source_path, index) => ({
      id: `installed-${index}`,
      install_name: `lab-${index}`,
      source_path,
      source_kind: "local_path" as const,
      extension_id: `pstdio.lab-${index}`,
      source_hash: "adopted-before-host-update",
      updated_at: "2026-11-13T00:00:00.000Z",
    })),
  };
};

test("startup skips incompatible webviews without a build error and recovers after an extension update", async () => {
  const { root, paths, rows, setRange } = fixture();
  const errors: unknown[] = [];
  const built: string[] = [];
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => rows,
    onError: (error) => errors.push(error),
    reportBuildFailure: async () => "reported",
    reportBuildSuccess: async () => "reported",
    buildWebview: async (input) => {
      built.push(input.entryPath);
      writeManagedBuildOutput(input);
      return { success: true, details: "" };
    },
    webviewCacheRoot: join(root, "cache"),
  });
  try {
    await manager.refresh();
    expect(built).toHaveLength(1);
    expect(errors).toEqual([]);
    setRange(`^${EXTENSION_API_VERSION}`);
    await manager.refresh(paths[1]);
    expect(built).toHaveLength(2);
    expect(errors).toEqual([]);
  } finally {
    manager.dispose();
    rmSync(root, { recursive: true, force: true });
  }
});

test("runtime keeps incompatible extension diagnostics while healthy extensions work and recovery preserves enablement", async () => {
  const { root, paths, rows, setRange } = fixture();
  const enabled = rows.map((installedSource) => ({
    installedSource,
    instance: { id: `${installedSource.id}-instance`, enabled: true, config_json: { preserved: true } },
  }));
  const catalog = createProjectExtensionRuntimeCatalog({
    extensionService: { listEnabledSourcesForProject: async () => enabled } as never,
    projectService: { get: async (id: string) => ({ id, name: "Isolated", shorthand: "ISO" }) } as never,
    workspaceService: { getDefault: async () => null } as never,
  });
  try {
    const snapshot = await catalog.get("isolated");
    expect(snapshot.stale).toBeNull();
    expect(snapshot.runtime.views.map((view) => view.id)).toEqual(["pstdio.lab-0.view.labPage"]);
    expect(snapshot.runtime.diagnostics).toContainEqual(
      expect.objectContaining({
        code: "extension_manifest_unsupported_api_version",
        extensionId: "pstdio.lab-1",
      }),
    );
    const hostRuntime = await catalog.getSourcesRuntime(rows);
    expect(hostRuntime.diagnostics).toContainEqual(
      expect.objectContaining({ code: "extension_manifest_unsupported_api_version" }),
    );

    // A separately released update can still be incompatible. Its identity must
    // refresh even though the compatibility diagnostic has not changed.
    const packagePath = join(paths[1]!, "package.json");
    const manifest = JSON.parse(readFileSync(packagePath, "utf8"));
    writeFileSync(packagePath, JSON.stringify({ ...manifest, version: "1.1.0", displayName: "Updated Lab" }));
    catalog.invalidate({ sourcePath: paths[1], reason: "source_changed" });
    const stillIncompatible = await catalog.get("isolated");
    expect(stillIncompatible.runtime.extensions).toContainEqual(
      expect.objectContaining({ id: "pstdio.lab-1", version: "1.1.0", displayName: "Updated Lab" }),
    );
    expect(stillIncompatible.runtime.views).toHaveLength(1);

    setRange(`^${EXTENSION_API_VERSION}`);
    catalog.invalidate({ sourcePath: paths[1], reason: "source_changed" });
    const recovered = await catalog.get("isolated");
    expect(recovered.runtime.views).toHaveLength(2);
    expect(recovered.runtime.diagnostics).toEqual([]);
    expect(enabled.every(({ instance }) => instance.enabled && instance.config_json.preserved)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
