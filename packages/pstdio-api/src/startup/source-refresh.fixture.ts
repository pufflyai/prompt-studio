import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { checkExtensionSource } from "../features/extensions/extension-runtime";
import { installExtensionSource } from "../features/extensions/install-extension-source";
import { createTestApp } from "../test-utils/create-test-app";
import { prepareSourceRefreshFixture } from "./source-refresh-source.fixture";

const waitFor = async (predicate: () => boolean) => {
  const deadline = Date.now() + 10_000;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error("Timed out waiting for startup background work");
    await Bun.sleep(10);
  }
};

const assertExistingProjectSourceRefresh = async (tempRoot: string, source: string) => {
  const root = join(tempRoot, "existing-project-source-refresh");
  const pstdioHome = join(root, "home");
  const databasePath = join(root, "database");
  const storageRoot = join(root, "storage");
  const installed = join(pstdioHome, "extensions/startup-fixture");

  await installExtensionSource({
    source,
    installName: "startup-fixture",
    env: { ...process.env, PSTDIO_HOME: pstdioHome },
  });
  const validation = await checkExtensionSource(installed, dirname(installed));
  assert.equal(validation.check.errorCount, 0);

  process.env.PSTDIO_HOME = pstdioHome;
  process.env.PSTDIO_DEFAULT_EXTENSIONS = "[]";
  const initial = await createTestApp({ databasePath, storageRoot });
  await initial.deps.projectService.create({ name: "Existing project" });
  await initial.close();

  writeFileSync(join(installed, "README.md"), "stale source fixture");
  process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
  process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "startup-fixture", force: true }]);

  const restarted = await createTestApp({ databasePath, storageRoot });
  try {
    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale source fixture");
    assert.equal(readFileSync(join(installed, "README.md"), "utf8"), readFileSync(join(source, "README.md"), "utf8"));
  } finally {
    await restarted.close();
  }
};

const tempRoot = mkdtempSync(join(tmpdir(), "startup-refresh-"));
// Runtime validation reads the process home before the test app replaces it.
process.env.PSTDIO_HOME = tempRoot;
try {
  const source = prepareSourceRefreshFixture(tempRoot);
  if (process.argv[2] === "existing") {
    await assertExistingProjectSourceRefresh(tempRoot, source);
  } else {
    const pstdioHome = join(tempRoot, "home-source-refresh");
    const installed = join(pstdioHome, "extensions/startup-fixture");
    await installExtensionSource({ source, env: { ...process.env, PSTDIO_HOME: pstdioHome } });
    writeFileSync(join(installed, "README.md"), "stale source fixture");

    process.env.PSTDIO_HOME = pstdioHome;
    process.env.PSTDIO_DISABLE_EMBED_MANIFEST = "1";
    process.env.PSTDIO_DEFAULT_EXTENSIONS = JSON.stringify([{ source, installName: "startup-fixture", force: true }]);

    const { close } = await createTestApp({
      databasePath: ":memory:",
      storageRoot: join(tempRoot, "storage-source-refresh"),
    });

    await waitFor(() => readFileSync(join(installed, "README.md"), "utf8") !== "stale source fixture");
    await close();

    assert.equal(readFileSync(join(installed, "README.md"), "utf8"), readFileSync(join(source, "README.md"), "utf8"));
  }
} finally {
  // ADR 0039: shutdown is awaited above; yield while Windows releases filesystem handles.
  await rm(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
