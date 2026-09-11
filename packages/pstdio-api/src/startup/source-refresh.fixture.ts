import { strict as assert } from "node:assert";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { installExtensionSource } from "../features/extensions/install-extension-source";
import { createTestApp } from "../test-utils/create-test-app";

const REPO_ROOT = resolve(import.meta.dir, "../../../..");
const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for startup background work");
    await Bun.sleep(10);
  }
};

const assertExistingProjectSourceRefresh = async (tempRoot: string) => {
  const root = join(tempRoot, "existing-project-source-refresh");
  const pstdioHome = join(root, "home");
  const databasePath = join(root, "database");
  const storageRoot = join(root, "storage");
  const source = resolve(REPO_ROOT, "extensions/extension-lab");
  const installed = join(pstdioHome, "extensions/extension-lab");

  await installExtensionSource({
    source,
    installName: "extension-lab",
    env: { ...process.env, PSTDIO_HOME: pstdioHome },
    skipInstall: true,
  });
  assert.equal(existsSync(join(installed, "node_modules/@pstdio/sdk/package.json")), true);

  process.env.PSTDIO_HOME = pstdioHome;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const initial = await createTestApp({ databasePath, storageRoot });
  await initial.deps.projectService.create({ name: "Existing project" });
  await initial.close();

  writeFileSync(join(installed, "README.md"), "stale extension lab");
  process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
    { source, installName: "extension-lab", force: true, skipInstall: true },
  ]);

  const restarted = await createTestApp({ databasePath, storageRoot });
  try {
    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale extension lab");
    assert.equal(readFileSync(join(installed, "README.md"), "utf8"), readFileSync(join(source, "README.md"), "utf8"));
  } finally {
    await restarted.close();
  }
};

const tempRoot = mkdtempSync(join(tmpdir(), "startup-refresh-"));
try {
  if (process.argv[2] === "existing") {
    await assertExistingProjectSourceRefresh(tempRoot);
  } else {
    const pstdioHome = join(tempRoot, "home-source-refresh");
    const source = resolve(REPO_ROOT, "extensions/extension-lab");
    const installed = join(pstdioHome, "extensions/extension-lab");
    await installExtensionSource({ source, env: { ...process.env, PSTDIO_HOME: pstdioHome }, skipInstall: true });
    writeFileSync(join(installed, "README.md"), "stale extension lab");

    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([
      { source, installName: "extension-lab", skipInstall: true, force: true },
    ]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-source-refresh"),
    });

    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale extension lab");
    await close();

    assert.equal(readFileSync(join(installed, "README.md"), "utf8"), readFileSync(join(source, "README.md"), "utf8"));
  }
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
