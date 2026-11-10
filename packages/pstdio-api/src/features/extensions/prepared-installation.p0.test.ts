import { afterEach, expect, test } from "bun:test";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  acceptPreparedRevision,
  createPreparationScope,
  prepareExtensionRevision,
  readAcceptedRevision,
  stopExtensionPreparation,
  withBackgroundPreparation,
} from "pstdio-extensions";
import { createExtensionInstallBatch } from "./extension-install-batch";
import { createExtensionWebviewBuildManager } from "./extension-webview-build-manager";
import { inspectManagedWebviewBuildInputs } from "./extension-webview-build-source";
import { installExtensionSource } from "./install-extension-source";
import { prepareWebviewArtifact, prepareWebviewArtifacts } from "./prepared-webview";
import { createExtensionSourceCache } from "./project-extension-runtime-sources";

const previousHome = process.env.PSTDIO_HOME;
const roots: string[] = [];
afterEach(async () => {
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-installation-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  mkdirSync(source);
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "prepared-install",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => "accepted" }], views: [{ id: "page", ref: { kind: "view", id: "page" }, title: "Page", body: { kind: "webview", entry: { kind: "package-asset", path: "./main.ts", baseUrl: import.meta.url } } }] };`,
  );
  writeFileSync(join(source, "main.ts"), 'console.log("prepared UI");');
  return { root, source };
};

test("installation retains validated webviews and activation reuses their exact output", async () => {
  const { root, source } = fixture();
  const installed = await installExtensionSource({ source, skipInstall: true });
  expect(installed.check.errorCount).toBe(0);
  const revision = installed.preparedRevision!;
  const viewId = "test.prepared-install.view.page";
  const artifact = revision.webviews![viewId]!;
  const before = statSync(join(artifact.distDir, "module.js")).mtimeMs;
  await acceptPreparedRevision(installed.targetPath, revision);
  const row = {
    id: "installed",
    source_path: installed.targetPath,
    install_name: installed.installName,
    source_hash: installed.sourceHash,
    updated_at: "first",
  };
  const manager = createExtensionWebviewBuildManager({
    listInstalledSources: async () => [row],
    webviewCacheRoot: join(root, "webviews"),
    reportBuildFailure: async (_id, _view, error) => {
      throw error;
    },
    reportBuildSuccess: async () => "reported",
  });
  try {
    await manager.adopt(installed.targetPath);
    expect(statSync(join(artifact.distDir, "module.js")).mtimeMs).toBe(before);
    const serving = join(root, "webviews", row.id, viewId, "dist", "module.js");
    expect(existsSync(serving)).toBe(true);
    expect(readFileSync(serving, "utf8")).toBe(readFileSync(join(artifact.distDir, "module.js"), "utf8"));
    await stopExtensionPreparation();
    expect((await readAcceptedRevision(installed.targetPath))?.id).toBe(revision.id);
    writeFileSync(join(installed.targetPath, "extension.ts"), "throw new Error('not adopted');");
    rmSync(serving);
    await manager.ensure(row.id, viewId);
    expect(readFileSync(serving, "utf8")).toBe(readFileSync(join(artifact.distDir, "module.js"), "utf8"));
    const cache = createExtensionSourceCache({});
    const cached = await cache.load({ source_path: installed.targetPath, source_kind: "local_path" });
    expect(cached?.diagnostics).toEqual([]);
    expect(await cached!.source.definition.commands![0].run({} as never, {})).toBe("accepted");
  } finally {
    manager.dispose();
  }
});

test("a broken replacement preserves the previous prepared runtime and installed source", async () => {
  const { source } = fixture();
  const first = await installExtensionSource({ source, skipInstall: true });
  await acceptPreparedRevision(first.targetPath, first.preparedRevision!);
  const original = readFileSync(join(first.targetPath, "main.ts"), "utf8");
  writeFileSync(join(source, "main.ts"), "export const broken = ;");
  const error = await installExtensionSource({ source, skipInstall: true, force: true }).catch((error: Error) => error);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toContain("cannot activate");
  expect(readFileSync(join(first.targetPath, "main.ts"), "utf8")).toBe(original);
  expect((await readAcceptedRevision(first.targetPath))?.id).toBe(first.preparedRevision!.id);
});

test("managed webviews retain dependencies that the runtime entry never imports", async () => {
  const { source } = fixture();
  const dependency = join(source, "node_modules", "webview-only");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "webview-only", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dependency, "index.js"), 'export const value = "frontend dependency";');
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "webview-only": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(source, "main.ts"), 'import { value } from "webview-only"; console.log(value);');
  const installed = await installExtensionSource({ source, skipInstall: true });
  const view = installed.preparedRevision!.webviews!["test.prepared-install.view.page"]!;
  expect(readFileSync(join(view.distDir, "module.js"), "utf8")).toContain("frontend dependency");
});

test("a retained replacement can roll back its source after activation fails", async () => {
  const { source } = fixture();
  const { activatePreparedInstall, settlePreparedInstall } = await import("./extension-install-transaction");
  const first = await installExtensionSource({ source, skipInstall: true });
  await acceptPreparedRevision(first.targetPath, first.preparedRevision!);
  const original = readFileSync(join(first.targetPath, "main.ts"), "utf8");
  writeFileSync(join(source, "main.ts"), 'console.log("replacement");');
  const next = await installExtensionSource({ source, skipInstall: true, force: true, retainBackup: true });
  await activatePreparedInstall(next.installation!);
  expect(readFileSync(join(next.targetPath, "main.ts"), "utf8")).toContain("replacement");
  await settlePreparedInstall(next.installation!, false);
  expect(readFileSync(join(first.targetPath, "main.ts"), "utf8")).toBe(original);
  expect((await readAcceptedRevision(first.targetPath))?.id).toBe(first.preparedRevision!.id);
});

test("an older rollback cannot undo a newer committed install with identical bytes", async () => {
  const { source } = fixture();
  const { activatePreparedInstall, settlePreparedInstall } = await import("./extension-install-transaction");
  await installExtensionSource({ source, skipInstall: true });
  writeFileSync(join(source, "main.ts"), 'console.log("newer");');
  const older = await installExtensionSource({ source, skipInstall: true, force: true, retainBackup: true });
  await activatePreparedInstall(older.installation!);
  const newer = await installExtensionSource({ source, skipInstall: true, force: true, retainBackup: true });
  await activatePreparedInstall(newer.installation!);
  await settlePreparedInstall(newer.installation!, true);
  await settlePreparedInstall(older.installation!, false);
  expect(readFileSync(join(newer.targetPath, "main.ts"), "utf8")).toContain("newer");
});

test("worker shutdown restores an activated install whose revision was never accepted", async () => {
  const { source } = fixture();
  const { activatePreparedInstall } = await import("./extension-install-transaction");
  const first = await installExtensionSource({ source, skipInstall: true });
  await acceptPreparedRevision(first.targetPath, first.preparedRevision!);
  writeFileSync(join(source, "main.ts"), 'console.log("unaccepted");');
  const next = await installExtensionSource({ source, skipInstall: true, force: true, retainBackup: true });
  // Preparing the candidate leaves the working source untouched.
  expect(readFileSync(join(first.targetPath, "main.ts"), "utf8")).toContain("prepared UI");
  await activatePreparedInstall(next.installation!);
  await stopExtensionPreparation();
  expect(readFileSync(join(first.targetPath, "main.ts"), "utf8")).toContain("prepared UI");
  expect(existsSync(next.installation!.intentPath)).toBe(false);
});

test("adopting an asset-only revision updates callbacks that read immutable files", async () => {
  const { source } = fixture();
  writeFileSync(
    join(source, "extension.ts"),
    `import { readFileSync } from "node:fs"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => readFileSync(new URL("./value.txt", import.meta.url), "utf8") }] };`,
  );
  writeFileSync(join(source, "value.txt"), "first");
  const first = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, first);
  const cache = createExtensionSourceCache({});
  const row = { source_path: source, source_kind: "local_path" as const };
  const old = await cache.load(row);
  writeFileSync(join(source, "value.txt"), "second");
  const next = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, next);
  cache.recheck(source);
  const current = await cache.load(row);
  expect(await old!.source.definition.commands![0].run({} as never, {})).toBe("first");
  expect(await current!.source.definition.commands![0].run({} as never, {})).toBe("second");
});

test.each([
  "notification",
  "webview",
])("a failed reload preserves the accepted revision after %s failure", async (failure) => {
  const { source } = fixture();
  const { createDb, createInstalledExtensionSourcesDBService } = await import("pstdio-db");
  const { reloadInstalledSourceBySourcePath } = await import("../../services/extension-reload");
  const first = await installExtensionSource({ source, skipInstall: true });
  await acceptPreparedRevision(first.targetPath, first.preparedRevision!);
  const database = await createDb({ path: ":memory:" });
  try {
    const sources = createInstalledExtensionSourcesDBService(database.db);
    await sources.register({
      install_name: first.installName,
      display_name: first.metadata.displayName,
      extension_id: first.metadata.id,
      manifest_json: first.manifest,
      source_path: first.targetPath,
      source_hash: first.sourceHash,
      source_kind: "local_path",
      source_ref: null,
      status: "loaded",
      version: "1.0.0",
    });
    writeFileSync(
      join(first.targetPath, "extension.ts"),
      readFileSync(join(first.targetPath, "extension.ts"), "utf8").replace('"accepted"', '"changed"'),
    );
    if (failure === "webview") writeFileSync(join(first.targetPath, "main.ts"), "export const broken = ;");
    let notifications = 0;
    const result = await reloadInstalledSourceBySourcePath(
      {
        installedExtensionSourcesService: sources,
        emitInstalledSource: () => {},
        notifyInstalledSourcesChanged: async () => {
          if (failure === "notification" && notifications++ === 0) throw new Error("cannot publish");
        },
      },
      first.targetPath,
    );
    expect(result.installedSource.status).toBe("error");
    expect(result.installedSource.source_hash).toBe(first.sourceHash);
    expect((await readAcceptedRevision(first.targetPath))?.id).toBe(first.preparedRevision!.id);
  } finally {
    await database.close();
  }
});

test.each(["claimed", "backed-up"])("recovery restores an interrupted %s promotion", async (phase) => {
  const { source } = fixture();
  const first = await installExtensionSource({ source, skipInstall: true });
  await acceptPreparedRevision(first.targetPath, first.preparedRevision!);
  writeFileSync(join(source, "main.ts"), 'console.log("unaccepted");');
  const next = await installExtensionSource({ source, skipInstall: true, force: true, retainBackup: true });
  const intent = JSON.parse(readFileSync(next.installation!.intentPath, "utf8"));
  const ownerPath = join(process.env.PSTDIO_HOME!, ".extension-source-locks", "source.owner");
  const previousToken = readFileSync(ownerPath, "utf8");
  intent.owner.pid = 99999999;
  intent.ownership = { ownerPath, token: crypto.randomUUID(), previousToken };
  writeFileSync(next.installation!.intentPath, JSON.stringify(intent));
  writeFileSync(ownerPath, intent.ownership.token);
  if (phase === "backed-up") renameSync(next.targetPath, join(intent.root, ".previous"));
  await stopExtensionPreparation();
  expect(readFileSync(join(first.targetPath, "main.ts"), "utf8")).toContain("prepared UI");
  expect(readFileSync(ownerPath, "utf8")).toBe(previousToken);
  expect(existsSync(next.installation!.intentPath)).toBe(false);
});

test.each(["direct", "stylesheet"])("dependency CSS asset edits invalidate %s frontend imports", async (kind) => {
  const { source } = fixture();
  const dependency = join(source, "node_modules", "styled-dependency");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "styled-dependency", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dependency, "index.js"), "export const value = 1;");
  writeFileSync(join(dependency, "style.css"), 'body { background: url("./texture.svg"); }');
  writeFileSync(
    join(dependency, "texture.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="red" d="M0 0h1v1z"/></svg>',
  );
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "styled-dependency": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(
    join(source, "main.ts"),
    kind === "direct" ? 'import "styled-dependency/style.css";' : 'import "./local.css";',
  );
  writeFileSync(join(source, "local.css"), '@import url("styled-dependency/style.css");');
  const first = await installExtensionSource({ source, skipInstall: true });
  writeFileSync(
    join(dependency, "texture.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg"><path fill="blue" d="M0 0h1v1z"/></svg>',
  );
  const next = await installExtensionSource({ source, skipInstall: true, force: true });
  const view = "test.prepared-install.view.page";
  expect(next.preparedRevision!.webviews![view]!.id).not.toBe(first.preparedRevision!.webviews![view]!.id);
});

test("validated webviews complete a concurrent runtime-only adoption without allowing stale output", async () => {
  const { source } = fixture();
  const installed = await installExtensionSource({ source, skipInstall: true });
  const complete = installed.preparedRevision!;
  const runtimeOnly = { ...complete, webviews: undefined };
  await acceptPreparedRevision(installed.targetPath, runtimeOnly);
  await acceptPreparedRevision(installed.targetPath, complete, { expectedState: null });
  expect((await readAcceptedRevision(installed.targetPath))!.webviews).toEqual(complete.webviews);
  const rejected = await acceptPreparedRevision(installed.targetPath, runtimeOnly, { expectedState: null }).catch(
    (error: Error) => error,
  );
  expect(rejected).toBeInstanceOf(Error);
});

test.each([
  "react",
  "custom-jsx",
])("implicit %s JSX runtime edits invalidate reusable frontend output", async (name) => {
  const { source } = fixture();
  const dependency = join(source, "node_modules", name);
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({
      name,
      version: "1.0.0",
      exports: { ".": "./index.js", "./jsx-runtime": "./runtime.js" },
    }),
  );
  writeFileSync(join(dependency, "index.js"), "export const unrelated = true;");
  const writeRuntime = (value: string) =>
    writeFileSync(
      join(dependency, "runtime.js"),
      `export const jsx = () => ({value: ${JSON.stringify(value)}}); export const jsxs = jsx; export const Fragment = Symbol();`,
    );
  writeRuntime("red");
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { [name]: "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  const entry = readFileSync(join(source, "extension.ts"), "utf8").replace("./main.ts", "./main.tsx");
  writeFileSync(join(source, "extension.ts"), entry);
  writeFileSync(
    join(source, "main.tsx"),
    `${name === "react" ? "" : `/** @jsxImportSource ${name} */`}\nconst node = <span/>; document.body.textContent = node.value;`,
  );
  const first = await installExtensionSource({ source, skipInstall: true });
  writeRuntime("blue");
  const next = await installExtensionSource({ source, skipInstall: true, force: true });
  const view = "test.prepared-install.view.page";
  expect(next.preparedRevision!.webviews![view]!.id).not.toBe(first.preparedRevision!.webviews![view]!.id);
});

test("one worker job prepares two default installs while either evaluation is waiting", async () => {
  const { source } = fixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let attempts = 0;
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch() {
      if (++attempts === 2) entered.resolve();
      await release.promise;
      return new Response("ready");
    },
  });
  const install = createExtensionInstallBatch(2);
  writeFileSync(join(source, "extension.ts"), `await fetch(${JSON.stringify(gate.url.href)}); export default {};`);
  const prepared = Promise.all([
    install({ source, installName: "first", skipInstall: true }),
    install({ source, installName: "second", skipInstall: true }),
  ]);
  try {
    await entered.promise;
    release.resolve();
    const results = await prepared;
    expect(attempts).toBe(2);
    expect(results.every((result) => existsSync(join(result.targetPath, "package.json")))).toBe(true);
  } finally {
    release.resolve();
    await prepared.catch(() => {});
    await gate.stop(true);
  }
});

test.each([
  "preparation",
  "validation",
])("a paired install retains its successful source after sibling %s fails", async (phase) => {
  const { source, root } = fixture();
  const broken = join(root, "broken");
  cpSync(source, broken, { recursive: true });
  writeFileSync(join(broken, "extension.ts"), 'throw new Error("Broken sibling"); export default {};');
  const install = createExtensionInstallBatch(2);
  const results = await Promise.allSettled([
    install({ source, installName: "working", skipInstall: true }),
    install({
      source: phase === "preparation" ? "broken-fixture" : broken,
      installName: "broken",
      skipInstall: true,
      ...(phase === "preparation"
        ? {
            prepareNamedSource: async () => {
              throw new Error("Broken checkout");
            },
          }
        : {}),
    }),
  ]);
  expect(results[0]!.status).toBe("fulfilled");
  expect(results[1]!.status).toBe("rejected");
  expect(existsSync(join(root, "home/extensions/working/package.json"))).toBe(true);
});

test.each([
  "browser.js",
  "./browser",
  "./browser-dir",
])("browser target %s edits invalidate reusable frontend output", async (target) => {
  const { source } = fixture();
  const dependency = join(source, "node_modules", "browser-package");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "browser-package", version: "1.0.0", main: "node.js", browser: target }),
  );
  writeFileSync(join(dependency, "node.js"), 'export const value = "node";');
  const browserEntry =
    target === "./browser-dir" ? join(dependency, "browser-dir/index.js") : join(dependency, "browser.js");
  mkdirSync(join(browserEntry, ".."), { recursive: true });
  writeFileSync(browserEntry, 'export const value = "red";');
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "browser-package": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(source, "main.ts"), 'import { value } from "browser-package"; console.log(value);');
  const first = await installExtensionSource({ source, skipInstall: true });
  writeFileSync(browserEntry, 'export const value = "blue";');
  const next = await installExtensionSource({ source, skipInstall: true, force: true });
  const view = "test.prepared-install.view.page";
  expect(next.preparedRevision!.webviews![view]!.id).not.toBe(first.preparedRevision!.webviews![view]!.id);
});

test("cancelled paired preparation recovers successful but undelivered retained installs", async () => {
  const { root, source } = fixture();
  const blocked = join(root, "blocked");
  cpSync(source, blocked, { recursive: true });
  writeFileSync(join(blocked, "extension.ts"), "await new Promise(() => {}); export default {};");
  const controller = new AbortController();
  const install = createExtensionInstallBatch(2);
  const results = Promise.allSettled([
    install({ source, installName: "first", skipInstall: true, retainBackup: true, signal: controller.signal }),
    install({
      source: blocked,
      installName: "blocked",
      skipInstall: true,
      retainBackup: true,
      signal: controller.signal,
    }),
  ]);
  const intents = join(root, "home/cache/extension-installations");
  while (!existsSync(intents) || !readdirSync(intents).some((name) => name.endsWith(".json"))) await Bun.sleep(10);
  const path = join(intents, readdirSync(intents).find((name) => name.endsWith(".json"))!);
  const stagedRoot = JSON.parse(readFileSync(path, "utf8")).root;
  controller.abort();
  expect((await results).every((result) => result.status === "rejected")).toBe(true);
  await installExtensionSource({ source, installName: "replacement-worker", skipInstall: true });
  expect(existsSync(path)).toBe(false);
  expect(existsSync(stagedRoot)).toBe(false);
});

test("local installation bypasses a shared named-source checkout resolver", async () => {
  const { source } = fixture();
  let resolved = false;
  const installed = await installExtensionSource({
    source,
    skipInstall: true,
    prepareNamedSource: async () => {
      resolved = true;
      throw new Error("The shared checkout only contains named catalog sources.");
    },
  });
  expect(installed.installName).toBe("source");
  expect(installed.check.errorCount).toBe(0);
  expect(resolved).toBe(false);
});

test("duplicate default targets adopt the last configured source once", async () => {
  const { root, source } = fixture();
  const other = join(root, "other");
  cpSync(source, other, { recursive: true });
  writeFileSync(join(other, "main.ts"), 'console.log("last default");');
  const { installDefaultExtensions } = await import("./default-extensions");
  const { assertPreparedInstallOwned, settlePreparedInstall } = await import("./extension-install-transaction");
  const registered: string[] = [];
  const result = await withBackgroundPreparation(() =>
    installDefaultExtensions({
      config: {
        defaultExtensions: [source, other].map((source) => ({
          source,
          installName: "same-target",
          force: true,
          skipInstall: true,
        })),
      },
      registerInstalledSources: async (sources) => {
        const scope = createPreparationScope();
        expect(scope.requested).toBe(true);
        scope.dispose();
        for (const installed of sources) {
          await assertPreparedInstallOwned(installed.installation!);
          registered.push(installed.targetPath);
          await settlePreparedInstall(installed.installation!, true);
        }
      },
    }),
  );
  expect(result).toHaveLength(1);
  expect(registered).toHaveLength(1);
  expect(readFileSync(join(result[0]!.targetPath, "main.ts"), "utf8")).toContain("last default");
});

test("delivered paired install handles survive preparation-worker replacement", async () => {
  const { source } = fixture();
  const install = createExtensionInstallBatch(2);
  const sources = await Promise.all(
    ["first", "second"].map((installName) => install({ source, installName, retainBackup: true, skipInstall: true })),
  );
  await stopExtensionPreparation(false);
  const { activatePreparedInstall, assertPreparedInstallOwned, settlePreparedInstall } = await import(
    "./extension-install-transaction"
  );
  for (const source of sources) {
    await activatePreparedInstall(source.installation!);
    await assertPreparedInstallOwned(source.installation!);
    await settlePreparedInstall(source.installation!, true);
    expect(existsSync(join(source.targetPath, "package.json"))).toBe(true);
  }
});

test("failed default registration preparation discards previously returned retained candidates", async () => {
  const { root, source } = fixture();
  const broken = join(root, "broken");
  cpSync(source, broken, { recursive: true });
  writeFileSync(join(broken, "extension.ts"), 'throw new Error("broken default"); export default {};');
  const { installDefaultExtensions } = await import("./default-extensions");
  const result = await installDefaultExtensions({
    config: {
      defaultExtensions: [source, broken].map((source, index) => ({
        source,
        installName: `default-${index}`,
        skipInstall: true,
      })),
    },
    registerInstalledSources: async () => {
      throw new Error("must not register a partial batch");
    },
  }).catch((error: Error) => error);
  expect(result).toBeInstanceOf(Error);
  const intents = join(root, "home/cache/extension-installations");
  expect(readdirSync(intents).filter((name) => name.endsWith(".json"))).toEqual([]);
});

test("default install pipeline fills a released slot while another source is blocked", async () => {
  const { root, source } = fixture();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const gate = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    async fetch(request) {
      const path = new URL(request.url).pathname;
      if (path === "/third") entered.resolve();
      if (path === "/first") await release.promise;
      return new Response("ready");
    },
  });
  const install = createExtensionInstallBatch(3);
  const prepared = Promise.all(
    ["first", "second", "third"].map((name) => {
      const path = join(root, name);
      cpSync(source, path, { recursive: true });
      writeFileSync(
        join(path, "extension.ts"),
        `await fetch(${JSON.stringify(new URL(name, gate.url).href)}); export default {};`,
      );
      return install({ source: path, installName: name, skipInstall: true });
    }),
  );
  try {
    await Promise.race([
      entered.promise,
      prepared.then(() => {
        throw new Error("The third source must start before releasing the first");
      }),
    ]);
    release.resolve();
    expect(await prepared).toHaveLength(3);
  } finally {
    release.resolve();
    await prepared.catch(() => {});
    await gate.stop(true);
  }
});

test("a frontend edited after inspection cannot publish under its earlier identity", async () => {
  const { source } = fixture();
  const input = {
    entryPath: join(source, "main.ts"),
    packagePath: source,
    packageName: "prepared-install",
    installName: "prepared-install",
  };
  const buildInputs = inspectManagedWebviewBuildInputs(input);
  writeFileSync(input.entryPath, 'console.log("changed after inspection");');
  await expect(prepareWebviewArtifact({ ...input, buildInputs }, new AbortController().signal)).rejects.toThrow(
    "changed while preparing",
  );
});

test("accepted frontend batches preserve complete output through refresh and stale reporting", async () => {
  const { root, source } = fixture();
  for (const name of ["first-dep", "second-dep"]) {
    const dependency = join(source, "node_modules", name);
    mkdirSync(dependency, { recursive: true });
    writeFileSync(join(dependency, "package.json"), JSON.stringify({ name, version: "1.0.0", main: "index.js" }));
    writeFileSync(join(dependency, "index.js"), `export const value = ${JSON.stringify(name)};`);
  }
  const manifest = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
  manifest.dependencies = { "first-dep": "1.0.0", "second-dep": "1.0.0" };
  writeFileSync(join(source, "package.json"), JSON.stringify(manifest));
  writeFileSync(join(source, "main.ts"), 'import { value } from "first-dep"; console.log(value);');
  writeFileSync(join(source, "other.ts"), 'import { value } from "second-dep"; console.log(value);');
  const entry = readFileSync(join(source, "extension.ts"), "utf8").replace(
    "views: [",
    'views: [{ id: "other", ref: { kind: "view", id: "other" }, title: "Other", body: { kind: "webview", entry: { kind: "package-asset", path: "./other.ts", baseUrl: import.meta.url } } },',
  );
  writeFileSync(join(source, "extension.ts"), entry);
  const installed = await installExtensionSource({ source, skipInstall: true });
  const reporting = Promise.withResolvers<void>();
  const releaseReport = Promise.withResolvers<void>();
  let paused = false;
  let reports = 0;
  const errors: unknown[] = [];
  const failures: unknown[] = [];
  const manager = createExtensionWebviewBuildManager({
    onError: (error) => errors.push(error),
    listInstalledSources: async () => [
      {
        id: "initial",
        source_path: source,
        install_name: "prepared-install",
        source_hash: null,
        updated_at: "initial",
      },
    ],
    webviewCacheRoot: join(root, "views"),
    reportBuildSuccess: async () => {
      reports++;
      if (!paused) {
        paused = true;
        reporting.resolve();
        await releaseReport.promise;
      }
      return "reported";
    },
    reportBuildFailure: async (_id, _view, error) => {
      failures.push(error);
      return "reported";
    },
  });
  try {
    const earlier = manager.ensure("initial");
    await reporting.promise;
    await acceptPreparedRevision(source, await prepareExtensionRevision(source));
    await manager.adopt(source);
    releaseReport.resolve();
    await earlier;
    expect((await readAcceptedRevision(source))!.webviews).toEqual(installed.preparedRevision!.webviews);
    const completedReports = reports;
    await manager.refresh(source);
    expect((await readAcceptedRevision(source))!.webviews).toEqual(installed.preparedRevision!.webviews);
    expect(reports).toBe(completedReports);
    writeFileSync(join(source, "node_modules", "first-dep", "index.js"), 'export const value = "changed frontend";');
    const expected = await prepareWebviewArtifacts(
      ["other.ts", "main.ts"].map((entry) => ({
        entryPath: join(source, entry),
        packagePath: source,
        packageName: "prepared-install",
        installName: "prepared-install",
      })),
      new AbortController().signal,
    );
    await manager.refresh(source);
    expect(errors).toEqual([]);
    expect((await readAcceptedRevision(source))!.webviews).toEqual({
      "test.prepared-install.view.other": { id: expected[0]!.id, distDir: expected[0]!.distDir },
      "test.prepared-install.view.page": { id: expected[1]!.id, distDir: expected[1]!.distDir },
    });
    const healthy = (await readAcceptedRevision(source))!.webviews;
    writeFileSync(join(source, "node_modules", "first-dep", "index.js"), "export const value = ;");
    writeFileSync(join(source, "node_modules", "second-dep", "index.js"), 'export const value = "partial update";');
    await manager.refresh(source);
    expect((await readAcceptedRevision(source))!.webviews).toEqual(healthy);
    expect(failures.length).toBeGreaterThan(0);
    expect(errors).toEqual([]);
    writeFileSync(join(source, "main.ts"), "throw new Error('unadopted');");
    rmSync(join(root, "views"), { recursive: true, force: true });
    await manager.ensure("initial", "test.prepared-install.view.page");
    expect(
      readFileSync(join(root, "views", "initial", "test.prepared-install.view.page", "dist", "module.js"), "utf8"),
    ).toContain("changed frontend");
  } finally {
    releaseReport.resolve();
    manager.dispose();
  }
});
