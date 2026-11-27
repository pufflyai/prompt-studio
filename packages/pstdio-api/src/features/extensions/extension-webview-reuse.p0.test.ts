import { expect, spyOn, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { historicalContributionId } from "pstdio-api-contracts/extension-host";
import * as extensions from "pstdio-extensions";
import { acceptPreparedRevision, prepareExtensionRevision } from "pstdio-extensions";
import type { ProjectExtensionRuntimeCatalog } from "./project-extension-runtime-catalog";
import {
  createApp,
  webviewAccess,
  webviewBasePath,
  webviewScope,
  writeExtension,
} from "./test-utils/webview-asset-app";

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "webview-entry-reuse-"));
  const sourcePath = join(root, "source");
  const cacheRoot = join(root, "cache");
  writeExtension(sourcePath, "./src/main.tsx");
  const dist = join(cacheRoot, "installed-lab/pstdio.lab.view.labPage/dist");
  mkdirSync(dist, { recursive: true });
  for (const file of ["module.js", ...Array.from({ length: 8 }, (_, index) => `chunk-${index}.js`)])
    writeFileSync(join(dist, file), `export const file = ${JSON.stringify(file)};`);
  const rows = [
    {
      id: "installed-lab",
      install_name: "extension-lab",
      source_path: sourcePath,
      last_error_json: undefined as unknown,
    },
  ];
  let catalog!: ProjectExtensionRuntimeCatalog;
  const app = createApp({
    cacheRoot,
    sourcePath,
    sources: rows,
    onCatalog: (value) => {
      catalog = value;
    },
  });
  return { root, sourcePath, app, rows, catalog: () => catalog };
};

test("serves a chunk graph without repeatedly normalizing its unchanged source", async () => {
  const f = fixture();
  const normalization = spyOn(extensions, "normalizeExtensionSources");
  try {
    expect((await f.app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(200);
    const initial = normalization.mock.calls.length;
    expect(initial).toBeGreaterThan(0);
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) => f.app.request(`${webviewBasePath}/assets/chunk-${index}.js`)),
    );
    expect(responses.map((response) => response.status)).toEqual(Array(8).fill(200));
    expect(await responses[7]!.text()).toContain('"chunk-7.js"');
    expect(normalization.mock.calls.length).toBe(initial);
  } finally {
    normalization.mockRestore();
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("asset lookup remains isolated from mutable contribution inspection results", async () => {
  const f = fixture();
  try {
    expect((await f.app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(200);
    const exposed = await f.catalog().getSourcesRuntime([{ source_path: f.sourcePath, source_kind: "local_path" }]);
    exposed.views.splice(0);
    exposed.diagnostics.push({ code: "consumer-only", severity: "error", message: "Local inspection" });
    const next = await f.catalog().getSourcesRuntime([{ source_path: f.sourcePath, source_kind: "local_path" }]);
    expect(next.views).toHaveLength(1);
    expect(next.diagnostics.some((entry) => entry.code === "consumer-only")).toBe(false);
    const selected = await f
      .catalog()
      .getSourceWebview({ source_path: f.sourcePath, source_kind: "local_path" }, webviewScope.webviewId);
    expect(selected).not.toBeNull();
    selected!.entry.path = "./unsupported.html";
    expect((await f.app.request(`${webviewBasePath}/assets/chunk-0.js`)).status).toBe(200);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("cached asset declarations observe adopted removals and source identity conflicts", async () => {
  const f = fixture();
  try {
    expect((await f.app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(200);
    f.rows[0]!.last_error_json = { code: "extension_identity_conflict" };
    expect((await f.app.request(`${webviewBasePath}/assets/chunk-0.js`)).status).toBe(404);
    f.rows[0]!.last_error_json = undefined;
    expect((await f.app.request(`${webviewBasePath}/assets/chunk-0.js`)).status).toBe(200);
    writeFileSync(join(f.sourcePath, "extension.ts"), "export default { views: [] };\n");
    await acceptPreparedRevision(f.sourcePath, await prepareExtensionRevision(f.sourcePath));
    f.catalog().invalidate({ sourcePath: f.sourcePath, reason: "source_changed" });
    expect((await f.app.request(`${webviewBasePath}/assets/module.js`)).status).toBe(404);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("asset lookup retains declared aliases for historically renamed owners", async () => {
  const f = fixture();
  try {
    const path = join(f.sourcePath, "package.json");
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    manifest.name = "planner";
    writeFileSync(path, JSON.stringify(manifest));
    const scope = { ...webviewScope, webviewId: "pstdio.planner.view.labPage" };
    const dist = join(f.root, "cache", scope.installedExtensionId, scope.webviewId, "dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(join(dist, "module.js"), "export const alias = true;");
    const legacy = historicalContributionId({ extensionId: "pstdio.planner", kind: "view", id: "labPage" });
    expect(legacy).toBeTruthy();
    expect(legacy).not.toBe(scope.webviewId);
    const alias = webviewAccess.assetUrl({ ...scope, webviewId: legacy! }, "module.js");
    const response = await f.app.request(alias);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("alias = true");
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
