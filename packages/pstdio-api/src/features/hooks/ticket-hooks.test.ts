import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDb,
  createExtensionInstancesDBService,
  createExtensionStorageDBService,
  createInstalledExtensionSourcesDBService,
  createProjectsDBService,
} from "pstdio-db";
import { createExtensionService } from "../../services/extension-service";
import { createProjectService } from "../../services/project-service";
import { createPluginService } from "../plugins/plugin-service";
import { fireTicketHook } from "./ticket-hooks";

let repoDir: string;
let closeDb: (() => Promise<void>) | undefined;

beforeEach(async () => {
  repoDir = await realpath(await mkdtemp(join(tmpdir(), "pstdio-ticket-hooks-test-")));
});

afterEach(async () => {
  await rm(repoDir, { recursive: true, force: true });
  await closeDb?.();
  closeDb = undefined;
});

const writePlugin = (fileName: string, code: string) => {
  const pluginsDir = join(repoDir, ".pstdio", "plugins");
  mkdirSync(pluginsDir, { recursive: true });
  writeFileSync(join(pluginsDir, fileName), code);
};

const makeDeps = () => ({
  pluginService: createPluginService({
    repoService: { listByProject: async () => [{ path: repoDir }] },
    listProjectIds: async () => ["proj-1"],
    filesRoot: "",
    storageRoot: repoDir,
    ensureWorkspace: async () => {},
  }),
});

const writeExtension = (root: string) => {
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({
      name: "guard",
      version: "1.0.0",
      publisher: "pstdio",
      main: "./extension.ts",
      engines: { pstdio: "^1.0.0" },
    }),
  );
  writeFileSync(
    join(root, "extension.ts"),
    `export default {
      hooks: {
        gate: {
          eventId: "kernel.preTicketStatusChange",
          handler() { throw new Error("tests failed"); }
        }
      }
    };`,
  );
};

describe("fireTicketHook", () => {
  test("pre-hook can reject", async () => {
    writePlugin(
      "guard.ts",
      `export default { hooks: { preTicketCreation: () => ({ reject: true, reason: "Missing description" }) } };`,
    );

    const result = await fireTicketHook(makeDeps(), "preTicketCreation", "proj-1", {
      title: "Incomplete",
    });

    expect(result.rejected).toBe(true);
    expect(result.stderr).toContain("Missing description");
  });

  test("allows when no plugins exist", async () => {
    const result = await fireTicketHook(makeDeps(), "preTicketCreation", "proj-1", {
      title: "Test",
    });

    expect(result.rejected).toBe(false);
  });

  test("pre-hook passes when handler does not reject", async () => {
    writePlugin("pass.ts", `export default { hooks: { preTicketDeletion: () => {} } };`);

    const result = await fireTicketHook(makeDeps(), "preTicketDeletion", "proj-1", {
      id: "TK-1",
    });

    expect(result.rejected).toBe(false);
  });

  test("pre-hook rejects when an extension hook fails", async () => {
    const result = await createDb({ path: ":memory:" });
    closeDb = result.close;
    const projectService = createProjectService({ projectsDBService: createProjectsDBService(result.db) });
    const extensionInstancesService = createExtensionInstancesDBService(result.db);
    const extensionService = createExtensionService({
      extensionInstancesService,
      installedExtensionSourcesService: createInstalledExtensionSourcesDBService(result.db),
      projectService,
    });
    const project = await projectService.create({ name: "Hooks" });
    const extensionPath = join(repoDir, "extension");
    writeExtension(extensionPath);
    await extensionService.enableInstalledSourceForProject({
      displayName: "guard",
      extensionId: "pstdio.guard",
      installName: "global:guard",
      manifest: {},
      name: "guard",
      projectId: project.id,
      sourceKind: "local_path",
      sourcePath: extensionPath,
      version: "1.0.0",
    });

    const hookResult = await fireTicketHook(
      {
        ...makeDeps(),
        activityEventsService: { create: async () => ({ id: "activity-1" }) },
        extensionService,
        extensionStorageService: createExtensionStorageDBService(result.db),
        fileService: {},
        repoService: { get: async () => null, listByProject: async () => [] },
        sessionService: { create: async () => ({ id: "session-1" }) },
        workspaceService: {
          archive: async () => {},
          get: async () => null,
          list: async () => [],
          softDelete: async () => {},
        },
      } as never,
      "preTicketStatusChange",
      project.id,
      { id: "PS-1" },
    );

    expect(hookResult.rejected).toBe(true);
    expect(hookResult.stderr).toContain("tests failed");
  });
});
