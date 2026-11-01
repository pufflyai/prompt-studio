import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preparePackagedExtensionSource } from "./packaged-extension-source";
import { preparePlannerSource } from "./packaged-planner-source";

interface ExtensionLock {
  packages: Record<string, [string, ...unknown[]]>;
  workspaces: Record<string, { dependencies: Record<string, string> }>;
}

let root = "";
afterEach(() => rm(root, { recursive: true, force: true }));

test("preparing an SDK-only extension does not add an undeclared UI dependency", async () => {
  root = await mkdtemp(join(tmpdir(), "sdk-only-extension-source-"));
  const original = join(root, "original");
  await mkdir(original);
  await Bun.write(
    join(original, "package.json"),
    JSON.stringify({
      name: "sdk-only-fixture",
      version: "1.0.0",
      dependencies: { "@pstdio/sdk": "0.45.0" },
    }),
  );
  const source = await preparePackagedExtensionSource(join(root, "prepared"), original);
  const manifest = await Bun.file(join(source, "package.json")).json();
  expect(manifest.dependencies["@pstdio/sdk"]).toStartWith("file:");
  expect(manifest.dependencies["@pstdio/ui"]).toBeUndefined();
  expect(manifest.overrides["@pstdio/ui"]).toBeUndefined();
});

test("keeps locked third-party versions when substituting public workspace packages", async () => {
  root = await mkdtemp(join(tmpdir(), "locked-extension-source-"));
  const original = join(root, "original");
  await mkdir(original);
  await Bun.write(
    join(original, "package.json"),
    JSON.stringify({ name: "locked-fixture", version: "1.0.0", dependencies: { react: "19.2.4" } }),
  );
  const lockedSource = await preparePackagedExtensionSource(join(root, "locked"), original);
  const manifest = await Bun.file(join(lockedSource, "package.json")).json();
  const lock = Bun.JSONC.parse(await Bun.file(join(lockedSource, "bun.lock")).text()) as ExtensionLock;
  expect(lock.packages.react[0]).toBe("react@19.2.4");
  manifest.dependencies.react = "^19.0.0";
  lock.workspaces[""].dependencies.react = "^19.0.0";
  await Bun.write(join(lockedSource, "package.json"), JSON.stringify(manifest));
  await Bun.write(join(lockedSource, "bun.lock"), JSON.stringify(lock));

  const source = await preparePackagedExtensionSource(join(root, "prepared"), lockedSource);
  const preparedLock = Bun.JSONC.parse(await Bun.file(join(source, "bun.lock")).text()) as ExtensionLock;
  expect(preparedLock.packages.react[0]).toBe(lock.packages.react[0]);
});

// A release PR raises the workspace versions before they are published, so a
// Prompt Studio package resolved from npm fails there even when it works on main.
for (const name of ["planner", "lab"])
  test(`resolves public packages in the ${name} fixture to workspace builds`, async () => {
    root = await mkdtemp(join(tmpdir(), "planner-source-"));
    const source =
      name === "planner"
        ? await preparePlannerSource(root)
        : await preparePackagedExtensionSource(root, join(import.meta.dirname, "../../../../extensions/extension-lab"));

    const lock = Bun.JSONC.parse(await Bun.file(join(source, "bun.lock")).text()) as ExtensionLock;
    const resolved = Object.values(lock.packages)
      .map(([id]) => id)
      .filter((id) => id.startsWith("@pstdio/"));
    expect(resolved).toEqual(
      expect.arrayContaining([expect.stringMatching(/^@pstdio\/sdk@/), expect.stringMatching(/^@pstdio\/ui@/)]),
    );
    expect(resolved.filter((id) => !id.includes(root))).toEqual([]);
  });
