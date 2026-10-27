import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import { writeExtension } from "../extensions/default-extensions-test-fixtures";
import { applyProjectHarnessSelection } from "./apply-harness-selection";

const previous = { home: process.env.PSTDIO_HOME, catalog: process.env.PSTDIO_EXTENSION_CATALOG };
let root: string | undefined;
let handle: Awaited<ReturnType<typeof createTestApp>> | undefined;

afterEach(async () => {
  await handle?.close();
  if (previous.home === undefined) delete process.env.PSTDIO_HOME;
  else process.env.PSTDIO_HOME = previous.home;
  if (previous.catalog === undefined) delete process.env.PSTDIO_EXTENSION_CATALOG;
  else process.env.PSTDIO_EXTENSION_CATALOG = previous.catalog;
  if (root) rmSync(root, { recursive: true, force: true });
});

test("an unselected harness keeps its host-required extension enabled", async () => {
  root = mkdtempSync(join(tmpdir(), "harness-selection-"));
  process.env.PSTDIO_HOME = join(root, "home");
  process.env.PSTDIO_EXTENSION_CATALOG = join(root, "catalog.json");
  const origin = {
    kind: "git",
    url: "https://github.com/pufflyai/prompt-studio",
    path: "extensions/agents",
    ref: "main",
  };
  writeFileSync(
    process.env.PSTDIO_EXTENSION_CATALOG,
    JSON.stringify({
      version: 1,
      extensions: [
        { installName: "agents", displayName: "Agents", description: "", default: false, alwaysEnabled: true, origin },
      ],
    }),
  );
  const sourcePath = join(process.env.PSTDIO_HOME, "extensions", "agents");
  writeExtension(sourcePath, "agents", "user");
  handle = await createTestApp({ databasePath: ":memory:", storageRoot: join(root, "storage") });
  const { extensionService, projectService } = handle.deps;
  const project = await projectService.create({ name: "Harness selection" });
  const enabled = await extensionService.syncInstalledSourceForProject({
    displayName: "Agents",
    extensionId: "pstdio.agents",
    installName: "agents",
    manifest: {},
    name: "agents",
    projectId: project.id,
    sourcePath,
  });
  expect(enabled?.instance.enabled).toBe(true);

  const harnessRegistry = { list: async () => [{ id: "pstdio.agents.harness.agent", extensionId: "pstdio.agents" }] };
  await applyProjectHarnessSelection(
    { extensionService, harnessRegistry: harnessRegistry as never },
    { projectId: project.id, selectedHarnessIds: [] },
  );

  expect((await extensionService.listEnabledSourcesForProject(project.id))[0]?.instance.id).toBe(enabled!.instance.id);
});
