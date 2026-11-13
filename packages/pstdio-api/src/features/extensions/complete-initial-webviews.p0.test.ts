import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptPreparedRevision,
  createPreparationScope,
  readAcceptedRevision,
  stopExtensionPreparation,
  withBackgroundPreparation,
} from "pstdio-extensions";
import { createInitialWebviewCompletion } from "./complete-initial-webviews";
import { loadExtensionSource } from "./extension-runtime";
import { inspectWebviewLoadKey } from "./extension-webview-source-inspection";
import { installExtensionSource } from "./install-extension-source";
import { writeExtension } from "./test-utils/webview-build-fixture";

test("a later dependency edit gets fresh validation after an overlapping frontend completion", async () => {
  const root = mkdtempSync(join(tmpdir(), "frontend-completion-dependency-edit-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "extension");
  writeExtension(source, { main: "src/main.ts" }, { dependencies: { "shared-dep": "1.0.0" } });
  const dependency = join(source, "node_modules", "shared-dep");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "shared-dep", version: "1.0.0", main: "index.js" }),
  );
  const dependencyFile = join(dependency, "index.js");
  writeFileSync(dependencyFile, 'export const value = "initial dependency";');
  const entry = join(source, "extension.ts");
  writeFileSync(
    entry,
    `import "shared-dep";\n${readFileSync(entry, "utf8").replace('id: "main",', 'id: "main", ref: { kind: "view", id: "main" },')}`,
  );
  writeFileSync(join(source, "src/main.ts"), 'import { value } from "shared-dep"; console.log(value);');
  const reporting = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const work: Promise<unknown>[] = [];
  try {
    const installed = await installExtensionSource({ source, skipInstall: true });
    await acceptPreparedRevision(source, installed.preparedRevision!);
    const loaded = await loadExtensionSource(source, { preparedRevision: installed.preparedRevision });
    const row = {
      id: "lab",
      install_name: "lab",
      source_path: source,
      source_hash: "unchanged",
      updated_at: "initial",
    };
    const snapshot = { loaded, loadKey: await inspectWebviewLoadKey(source) };
    const complete = createInitialWebviewCompletion(new Set());
    let paused = false;
    const input = {
      current: { row, snapshot },
      loadCurrent: async () => ({ row, snapshot: { loaded, loadKey: await inspectWebviewLoadKey(source) } }),
      retirePriorAttempts: () => {},
      reportResult: async () => {
        if (!paused) {
          paused = true;
          reporting.resolve();
          await release.promise;
        }
        return "reported" as const;
      },
    };
    writeFileSync(dependencyFile, 'export const value = "earlier dependency";');
    work.push(complete(input));
    await reporting.promise;
    writeFileSync(dependencyFile, 'export const value = "latest dependency";');
    expect(await inspectWebviewLoadKey(source)).toBe(snapshot.loadKey);
    // Joining is synchronous here: the later check cannot accidentally start only
    // after the first completion has already left its shared entry.
    work.push(complete(input));
    release.resolve();
    await Promise.all(work);
    const accepted = (await readAcceptedRevision(source))!;
    expect(accepted.id).toBe(installed.preparedRevision!.id);
    expect(readFileSync(join(accepted.webviews!["pstdio.lab.view.main"]!.distDir, "module.js"), "utf8")).toContain(
      "latest dependency",
    );
  } finally {
    release.resolve();
    await Promise.allSettled(work);
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});

test("a requested continuation lends urgency to the active completion before it starts", async () => {
  const root = mkdtempSync(join(tmpdir(), "frontend-completion-priority-"));
  const source = join(root, "extension");
  writeExtension(source, {});
  const loaded = await loadExtensionSource(source);
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const caller = withBackgroundPreparation(createPreparationScope);
  const observed: ReturnType<typeof createPreparationScope>[] = [];
  const work: Promise<unknown>[] = [];
  const complete = createInitialWebviewCompletion(new Set());
  const input = {
    current: {
      row: { id: "lab", install_name: "lab", source_path: source, updated_at: "initial" },
      snapshot: { loaded, loadKey: "same-key" },
    },
    loadCurrent: async () => {
      if (!observed.length) {
        observed.push(createPreparationScope());
        entered.resolve();
        await release.promise;
      }
      return null;
    },
    retirePriorAttempts: () => {},
    reportResult: async () => "reported" as const,
  };
  let releaseRequest: (() => void) | undefined;
  try {
    work.push(withBackgroundPreparation(() => complete(input)));
    await entered.promise;
    work.push(caller.run(() => complete(input)));
    expect(observed[0]!.requested).toBe(false);
    releaseRequest = caller.request();
    expect(observed[0]!.requested).toBe(true);
    releaseRequest();
    expect(observed[0]!.requested).toBe(false);
    release.resolve();
    await Promise.all(work);
  } finally {
    release.resolve();
    releaseRequest?.();
    caller.dispose();
    await Promise.allSettled(work);
    for (const scope of observed) scope.dispose();
    await stopExtensionPreparation();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a queued completion joins the current source key before reporting", async () => {
  const root = mkdtempSync(join(tmpdir(), "frontend-completion-key-change-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "extension");
  writeExtension(source, { main: "src/main.ts" });
  const entry = join(source, "extension.ts");
  writeFileSync(
    entry,
    readFileSync(entry, "utf8").replace('id: "main",', 'id: "main", ref: { kind: "view", id: "main" },'),
  );
  const gates = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const releases = [Promise.withResolvers<void>(), Promise.withResolvers<void>()];
  const promoted = Promise.withResolvers<string>();
  const caller = withBackgroundPreparation(createPreparationScope);
  const releaseRequest = caller.request();
  const observed: ReturnType<typeof createPreparationScope>[] = [];
  const work: Promise<unknown>[] = [];
  let reports = 0;
  let unsubscribe: (() => void) | undefined;
  try {
    const installed = await installExtensionSource({ source, skipInstall: true });
    await acceptPreparedRevision(source, installed.preparedRevision!);
    const loaded = await loadExtensionSource(source, { preparedRevision: installed.preparedRevision });
    const row = {
      id: "lab",
      install_name: "lab",
      source_path: source,
      source_hash: "unchanged",
      updated_at: "initial",
    };
    const current = async () => ({ row, snapshot: { loaded, loadKey: await inspectWebviewLoadKey(source) } });
    const complete = createInitialWebviewCompletion(new Set());
    const input = {
      current: await current(),
      loadCurrent: current,
      retirePriorAttempts: () => {},
      reportResult: async () => {
        const index = reports++;
        if (index === 1) {
          const scope = createPreparationScope();
          observed.push(scope);
          unsubscribe = scope.subscribe(() => {
            if (scope.requested) promoted.resolve("joined current key");
          });
        }
        if (index < 2) {
          gates[index]!.resolve();
          await releases[index]!.promise;
        } else promoted.resolve("duplicate reporting");
        return "reported" as const;
      },
    };
    writeFileSync(join(source, "src/main.ts"), 'console.log("source A");');
    input.current = await current();
    work.push(withBackgroundPreparation(() => complete(input)));
    await gates[0]!.promise;
    work.push(caller.run(() => complete(input)));
    writeFileSync(join(source, "src/main.ts"), 'console.log("source B");');
    work.push(withBackgroundPreparation(async () => complete({ ...input, current: await current() })));
    await gates[1]!.promise;
    releases[0]!.resolve();
    expect(await promoted.promise).toBe("joined current key");
    expect(reports).toBe(2);
    releases[1]!.resolve();
    await Promise.all(work);
    const accepted = (await readAcceptedRevision(source))!;
    expect(readFileSync(join(accepted.webviews!["pstdio.lab.view.main"]!.distDir, "module.js"), "utf8")).toContain(
      "source B",
    );
  } finally {
    for (const release of releases) release.resolve();
    releaseRequest();
    caller.dispose();
    await Promise.allSettled(work);
    unsubscribe?.();
    for (const scope of observed) scope.dispose();
    await stopExtensionPreparation();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    rmSync(root, { recursive: true, force: true });
  }
});
