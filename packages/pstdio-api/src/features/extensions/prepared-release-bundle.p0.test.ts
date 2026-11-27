import { afterEach, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";
import {
  acceptPreparedRevision,
  preparedRevisionState,
  prepareExtensionRevision,
  readAcceptedRevision,
  stopExtensionPreparation,
} from "pstdio-extensions";
import { preparedCacheRoot } from "pstdio-extensions/prepared-cache";
import { loadExtensionSource } from "./extension-runtime";
import { exportPreparedReleaseBundle, importPreparedReleaseBundle } from "./prepared-release-bundle";

const previousHome = process.env.PSTDIO_HOME;
const roots: string[] = [];
afterEach(async () => {
  await stopExtensionPreparation();
  if (previousHome === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previousHome;
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

// Release installs ship the editable source without its dependency tree; only the prebuilt runtime runs it.
const releaseInstall = async () => {
  const root = mkdtempSync(join(tmpdir(), "prepared-release-"));
  roots.push(root);
  process.env.PSTDIO_HOME = join(root, "home");
  const source = join(root, "source");
  const dependency = join(source, "node_modules", "release-dependency");
  mkdirSync(dependency, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "prepared-release",
      publisher: "test",
      version: "1.0.0",
      main: "./extension.ts",
      engines: { pstdio: `^${EXTENSION_API_VERSION}` },
      dependencies: { "release-dependency": "1.0.0" },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `import { value } from "release-dependency"; export default { commands: [{ id: "value", ref: { kind: "command", id: "value" }, title: "Value", run: async () => value }] };`,
  );
  writeFileSync(
    join(dependency, "package.json"),
    JSON.stringify({ name: "release-dependency", version: "1.0.0", main: "index.js" }),
  );
  writeFileSync(join(dependency, "index.js"), `export const value = "released";`);
  const sourceSha256 = "a".repeat(64);
  const archive = await exportPreparedReleaseBundle(await prepareExtensionRevision(source), sourceSha256);
  rmSync(join(source, "node_modules"), { recursive: true, force: true });
  const path = join(root, "runtime.tgz");
  await Bun.write(path, archive.bytes);
  const release = await importPreparedReleaseBundle(
    { path, descriptor: archive.descriptor, sourceSha256 },
    source,
    sourceSha256,
  );
  await acceptPreparedRevision(source, release);
  return { source, release };
};

test("an updated executable keeps running a release install that has no dependencies to rebuild from", async () => {
  const { source, release } = await releaseInstall();
  // The previous executable accepted the release; the bundle host it was verified against is unchanged.
  const accepted = join(preparedCacheRoot(), "accepted");
  const [pointer] = readdirSync(accepted).filter((name) => name.endsWith(".json"));
  writeFileSync(join(accepted, pointer!), JSON.stringify({ ...release, host: "previous-executable" }));

  const loaded = await loadExtensionSource(source, { accepted: true });

  expect(loaded.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
  expect((loaded.definition.commands as unknown[]).length).toBe(1);
  const previous = await readAcceptedRevision(source);
  expect(previous?.id).toBe(release.id);

  // An explicit upgrade replaces the inherited release under the same acceptance guard.
  writeFileSync(join(source, "extension.ts"), "export default { commands: [] };");
  const replacement = await prepareExtensionRevision(source);
  await acceptPreparedRevision(source, replacement, { expectedState: preparedRevisionState(previous) });
  expect((await readAcceptedRevision(source))?.id).toBe(replacement.id);
});
