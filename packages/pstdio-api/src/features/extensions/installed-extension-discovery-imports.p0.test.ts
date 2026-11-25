import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  acceptPreparedRevision,
  prepareExtensionRevision,
  readExtensionLoadCount,
  stopExtensionPreparation,
} from "pstdio-extensions";
import { loadAcceptedExtensionSource } from "./accepted-extension-source";
import { writeExtension } from "./default-extensions-test-fixtures";
import { loadExtensionSource } from "./extension-runtime";
import { syncInstalledExtensionsForProject } from "./installed-extension-sync";

const previousHome = process.env.PSTDIO_HOME;
const roots: string[] = [];
const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "installed-discovery-imports-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  const extensionsRoot = join(root, "extensions");
  const source = join(extensionsRoot, "discovery");
  writeExtension(source, "discovery");
  const manifests: Array<Record<string, unknown>> = [];
  const discover = (projectId = "project-1") =>
    syncInstalledExtensionsForProject({
      extensionsRoot,
      projectId,
      extensionService: {
        syncInstalledSourceForProject: async ({ manifest }) => {
          manifests.push(manifest as Record<string, unknown>);
          return {};
        },
      },
    });
  return { source, manifests, discover };
};

afterEach(async () => {
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test("project discovery imports an accepted revision once and adopts a newly accepted revision", async () => {
  const { source, manifests, discover } = fixture();
  const before = readExtensionLoadCount();
  await Promise.all([discover(), discover("first-concurrent-project")]);
  expect(readExtensionLoadCount() - before).toBe(1);
  await Promise.all([discover("project-2"), discover("project-3")]);
  expect(readExtensionLoadCount() - before).toBe(1);

  writeFileSync(join(source, "extension.ts"), 'export default { commands: { updated: { title: "Updated" } } };');
  const revision = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, revision);
  await discover();
  expect(manifests.at(-1)?.commands).toEqual(["updated"]);
  expect(readExtensionLoadCount() - before).toBe(2);
  await discover();
  expect(readExtensionLoadCount() - before).toBe(2);
});

test("failed discovery evaluation can recover without changing the source", async () => {
  const { source, manifests, discover } = fixture();
  let attempts = 0;
  const health = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: () => new Response(null, { status: ++attempts === 1 ? 503 : 200 }),
  });
  try {
    writeFileSync(
      join(source, "extension.ts"),
      `if (!(await fetch(${JSON.stringify(health.url.href)})).ok) throw new Error("Temporary activation failure");
       export default { commands: { recovered: { title: "Recovered" } } };`,
    );
    await discover();
    expect(manifests.at(-1)?.commands).toEqual([]);
    await discover();
    expect(manifests.at(-1)?.commands).toEqual(["recovered"]);
    expect(attempts).toBe(2);
    await discover();
    expect(attempts).toBe(2);
  } finally {
    await health.stop(true);
  }
});

test("discovery joins first admission after its accepted marker has been published", async () => {
  const { source, discover } = fixture();
  const adopted = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const before = readExtensionLoadCount();
  const first = loadAcceptedExtensionSource(source, async (_accepted, markAccepting) => {
    const loaded = await loadExtensionSource(source);
    markAccepting(loaded.preparedRevision!);
    await acceptPreparedRevision(source, loaded.preparedRevision!);
    adopted.resolve();
    await release.promise;
    return loaded;
  });
  let second: ReturnType<typeof discover> | undefined;
  try {
    await adopted.promise;
    // Hold the actual admission after marker publication. A second discovery must join
    // it instead of evaluating accepted callbacks independently while it is held.
    second = discover("project-during-adoption");
    const state = await Promise.race([
      second.then(() => "bypassed-admission"),
      Bun.sleep(250).then(() => "joined-admission"),
    ]);
    expect(state).toBe("joined-admission");
  } finally {
    release.resolve();
    await Promise.all([first, second]);
  }
  expect(readExtensionLoadCount() - before).toBe(1);
});

test.each([
  "throw",
  "diagnostics",
])("an obsolete cold admission adopts the newer revision after %s", async (failure) => {
  const { source, manifests, discover } = fixture();
  const started = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  if (failure === "diagnostics")
    writeFileSync(join(source, "extension.ts"), 'throw new Error("Obsolete module could not import");');
  const first = loadAcceptedExtensionSource(source, async (accepted) => {
    if (accepted) return loadExtensionSource(source);
    const failed = failure === "diagnostics" ? await loadExtensionSource(source) : undefined;
    started.resolve();
    await release.promise;
    if (failed) return failed;
    throw new Error("Another revision won acceptance");
  });
  let second: ReturnType<typeof discover> | undefined;
  try {
    await started.promise;
    writeFileSync(join(source, "extension.ts"), 'export default { commands: { current: { title: "Current" } } };');
    await acceptPreparedRevision(source, await prepareExtensionRevision(source));
    second = discover("project-with-current-revision");
    expect(await Promise.race([second.then(() => "current"), Bun.sleep(1_000).then(() => "waiting")])).toBe("current");
    release.resolve();
    const accepted = await first;
    await second;
    expect(accepted.manifest.commands).toEqual(["current"]);
    expect(manifests.at(-1)?.commands).toEqual(["current"]);
  } finally {
    release.resolve();
    await Promise.allSettled([first, second]);
  }
});
