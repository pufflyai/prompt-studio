import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import { createDb, createInstalledExtensionSourcesDBService } from "pstdio-db";
import { acceptPreparedRevision, readAcceptedRevision, stopExtensionPreparation } from "pstdio-extensions";
import { checkCandidateSource } from "../features/extensions/extension-candidate";
import { reloadInstalledSourceBySourcePath } from "./extension-reload";

const cleanup: Array<() => Promise<void> | void> = [];
afterEach(async () => {
  await stopExtensionPreparation();
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

test("a rejected webview reload reports its build error while retaining the accepted tool and can recover", async () => {
  const root = mkdtempSync(join(tmpdir(), "reload-webview-failure-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  cleanup.push(() => {
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  });
  const source = join(root, "source");
  mkdirSync(source);
  writeFileSync(join(source, "package.json"), JSON.stringify({
    name: "reload-view", publisher: "test", version: "1.0.0", main: "./extension.ts",
    engines: { pstdio: `^${EXTENSION_API_VERSION}` },
  }));
  writeFileSync(join(source, "extension.ts"), `export default { views: [{ id: "page", ref: { kind: "view", id: "page" }, title: "Page", body: { kind: "webview", entry: { kind: "package-asset", path: "./view.ts", baseUrl: import.meta.url } } }] };`);
  const view = join(source, "view.ts");
  writeFileSync(view, 'document.body.textContent = "Accepted view";');
  const initial = await checkCandidateSource(source);
  expect(initial.check.errorCount).toBe(0);
  expect(initial.loaded?.preparedRevision?.webviews).toBeDefined();
  const accepted = initial.loaded!.preparedRevision!;
  await acceptPreparedRevision(source, accepted);
  const oldModule = join(Object.values(accepted.webviews!)[0]!.distDir, "module.js");
  expect(readFileSync(oldModule, "utf8")).toContain("Accepted view");
  const database = await createDb({ path: ":memory:" });
  cleanup.push(database.close);
  const sources = createInstalledExtensionSourcesDBService(database.db);
  const row = await sources.register({ display_name: "Reload view", extension_id: "test.reload-view",
    install_name: "reload-view", manifest_json: initial.loaded!.manifest, source_hash: accepted.sourceHash,
    source_kind: "local_path", source_path: source, source_ref: null, status: "loaded",
    loaded_revision: "working-revision", version: "1.0.0" });
  const reload = () => reloadInstalledSourceBySourcePath({ installedExtensionSourcesService: sources,
    emitInstalledSource: () => {}, notifyInstalledSourcesChanged: async () => {} }, source);
  writeFileSync(view, "export const broken = ;");
  const rejected = await reload();
  expect(rejected.installedSource).toMatchObject({ status: "error", source_hash: accepted.sourceHash,
    loaded_revision: "working-revision", last_error_json: { code: "extension_webview_build_failed" } });
  expect((await sources.listReloadEvents(row.id)).at(-1)?.error_json).toMatchObject({ code: "extension_webview_build_failed" });
  expect((await readAcceptedRevision(source))?.id).toBe(accepted.id);
  expect(readFileSync(oldModule, "utf8")).toContain("Accepted view");
  writeFileSync(view, 'document.body.textContent = "Repaired view";');
  const repaired = await reload();
  expect(repaired.installedSource).toMatchObject({ status: "loaded", last_error_json: null });
  expect(repaired.installedSource.loaded_revision).not.toBe("working-revision");
  const current = await readAcceptedRevision(source);
  expect(current?.id).not.toBe(accepted.id);
  expect(readFileSync(join(Object.values(current!.webviews!)[0]!.distDir, "module.js"), "utf8")).toContain("Repaired view");
});
