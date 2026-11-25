import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceMaintenance } from "../../services/workspace-maintenance";
import { createTestApp } from "../../test-utils/create-test-app";
import { expectRejection } from "../../test-utils/expect-rejection";
import type { WorkspacesRouteDeps } from "./deps";
import { provisionProjectWorkspaces, runWorkspaceProvisioning } from "./provision-coordinator";
import { deleteWorkspace } from "./workspace-deletion";
import { createWorkspaceProviderDirectory } from "./workspace-provider-directory";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

test("queued provisioning leaves a deleted workspace directory removed", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-delete-first-"));
  const directory = join(root, "workspace");
  const app = await createTestApp();
  const deleting = Promise.withResolvers<void>();
  const releaseDeletion = Promise.withResolvers<void>();
  const listed = Promise.withResolvers<void>();
  let deletion: Promise<void> | undefined;
  let refresh: Promise<void> | undefined;
  let initial: Promise<unknown> | undefined;
  const originalList = app.deps.workspaceService.list;
  try {
    const project = await app.deps.projectService.create({ name: "Delete before file provisioning" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder", root_path: root });
    const created = await app.deps.workspaceService.create({
      project_id: project.id,
      shorthand_base: "QUEUED",
      provider_id: "fixture.local",
      provider_state: "ready",
    });
    const workspace = (await app.deps.workspaceService.updateProviderProjection(created.id, {
      execution_kind: "local",
      root_path: directory,
      provider_capabilities_json: { files: "write", diff: false, merge: false, rebase: false, delete: true },
    }))!;
    await mkdir(directory);
    deletion = deleteWorkspace(app.deps, workspace, {
      deleteProviderBackedWorkspace: async () => {
        deleting.resolve();
        await releaseDeletion.promise;
        await rm(directory, { recursive: true });
        return true;
      },
      fireExtensionEventAsync: () => {},
    });
    await deleting.promise;
    app.deps.workspaceService.list = async (...args) => {
      const rows = await originalList(...args);
      if (args[0] === project.id) listed.resolve();
      return rows;
    };
    const hooks = {
      ensureConfig: async (path: string) => {
        if (path === directory) await mkdir(directory, { recursive: true });
      },
      fireProvision: async () => ({ delivered: 0 }),
      fireReadyAsync: () => {},
    };
    refresh = provisionProjectWorkspaces(app.deps, project.id, hooks);
    initial = runWorkspaceProvisioning(app.deps, { projectId: project.id, workspace, repoPath: directory }, hooks);
    await listed.promise;
    releaseDeletion.resolve();
    await Promise.all([deletion, refresh, initial]);
    expect(Date.parse((await app.deps.workspaceService.get(workspace.id))?.deleted_at ?? "")).not.toBeNaN();
    expect(existsSync(directory)).toBe(false);
  } finally {
    releaseDeletion.resolve();
    await Promise.allSettled([deletion, refresh, initial]);
    app.deps.workspaceService.list = originalList;
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("refusing to delete the default workspace leaves it available for file maintenance", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-refused-delete-"));
  const app = await createTestApp();
  try {
    const project = await app.deps.projectService.create({ name: "Keep the default workspace available" });
    const workspace = await app.deps.workspaceService.ensureDefault({
      project_id: project.id,
      name: "Project folder",
      root_path: root,
    });
    const maintenance = createWorkspaceMaintenance(join(root, "pending"));
    app.deps.workspaceService.maintenance = maintenance;
    await expectRejection(deleteWorkspace(app.deps, workspace)).toThrow(/default workspace/i);
    expect(await maintenance.isRunning(workspace.id)).toBe(false);
  } finally {
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("deletions waiting for file writes leave capacity to delete another workspace", async () => {
  const app = await createTestApp();
  const releaseWriters = Promise.withResolvers<void>();
  const removeIndependent = Promise.withResolvers<void>();
  const independentStarted = Promise.withResolvers<boolean>();
  const operations: Promise<unknown>[] = [];
  try {
    const project = await app.deps.projectService.create({ name: "Independent workspace deletes" });
    const create = (name: string) =>
      app.deps.workspaceService.create({
        project_id: project.id,
        shorthand_base: name,
        provider_id: "fixture.local",
        provider_state: "ready",
      });
    const [first, second, independent] = [await create("FIRST"), await create("SECOND"), await create("OTHER")];
    const remove = (workspace: typeof first) =>
      deleteWorkspace(app.deps, workspace, {
        deleteProviderBackedWorkspace: async () => {
          if (workspace.id === independent.id) independentStarted.resolve(true);
          return false;
        },
      });
    const maintenance = app.deps.workspaceService.maintenance;
    operations.push(
      maintenance.run(first.id, async () => {
        await removeIndependent.promise;
        await remove(independent);
        await releaseWriters.promise;
      }),
      maintenance.run(second.id, () => releaseWriters.promise),
      remove(first),
      remove(second),
    );
    removeIndependent.resolve();
    const progressed = await Promise.race([independentStarted.promise, Bun.sleep(750).then(() => false)]);
    releaseWriters.resolve();
    await Promise.all(operations);
    expect(progressed).toBe(true);
    expect(Date.parse((await app.deps.workspaceService.get(independent.id))?.deleted_at ?? "")).not.toBeNaN();
  } finally {
    removeIndependent.resolve();
    releaseWriters.resolve();
    await Promise.allSettled(operations);
    await app.close();
  }
});

test("deleting a workspace drains its accepted skill writer before removing the directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-delete-writer-"));
  const directory = join(root, "workspace");
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removed = Promise.withResolvers<void>();
  let provisioning: Promise<void> | undefined;
  let deletion: Promise<void> | undefined;
  let released = false;
  let removedBeforeWriterFinished = false;
  try {
    const project = await app.deps.projectService.create({ name: "Owned skill files" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder", root_path: root });
    const created = await app.deps.workspaceService.create({
      project_id: project.id,
      shorthand_base: "WRITER",
      provider_id: "fixture.local",
      provider_state: "ready",
      root_path: directory,
    });
    const workspace = await app.deps.workspaceService.updateProviderProjection(created.id, {
      execution_kind: "local",
      provider_capabilities_json: { files: "write", diff: false, merge: false, rebase: false, delete: true },
    });
    await mkdir(directory);
    provisioning = provisionProjectWorkspaces(app.deps, project.id, {
      ensureConfig: async (path) => {
        if (path !== directory) return;
        entered.resolve();
        await release.promise;
        await mkdir(join(directory, ".claude/skills/owned"), { recursive: true });
        await writeFile(join(directory, ".claude/skills/owned/SKILL.md"), "Accepted before deletion");
      },
      fireProvision: async () => ({ delivered: 0 }),
      fireReadyAsync: () => {},
    });
    await entered.promise;
    deletion = deleteWorkspace(app.deps, workspace!, {
      deleteProviderBackedWorkspace: async () => {
        removedBeforeWriterFinished = !released;
        await rm(directory, { recursive: true, force: true });
        removed.resolve();
        return true;
      },
      fireExtensionEventAsync: () => {},
    });
    // Keep the real writer at its barrier while an uncoordinated removal can finish.
    await Promise.race([removed.promise, Bun.sleep(100)]);
    released = true;
    release.resolve();
    await Promise.all([provisioning, deletion]);
    expect(removedBeforeWriterFinished).toBe(false);
    expect(existsSync(directory)).toBe(false);
    expect(existsSync(root)).toBe(true);
  } finally {
    release.resolve();
    await Promise.allSettled([provisioning, deletion]);
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("deleting a workspace drains restart resolution before its owned directory can be recreated", async () => {
  const root = await mkdtemp(join(tmpdir(), "workspace-delete-recovery-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removed = Promise.withResolvers<void>();
  let recovery: Promise<void> | undefined;
  let deletion: Promise<void> | undefined;
  let directory: string | undefined;
  let released = false;
  let removedBeforeRecoveryFinished = false;
  let closeApp: (() => Promise<void>) | undefined;
  try {
    const app = await createTestApp();
    closeApp = app.close;
    const project = await app.deps.projectService.create({ name: "Recovered local provider" });
    const created = await app.deps.workspaceService.create({
      project_id: project.id,
      shorthand_base: "RECOVERY",
      provider_id: "fixture.local",
      provider_state: "ready",
    });
    directory = join(root, "workspaces", created.id);
    const capabilities = { files: "write" as const, diff: false, merge: false, rebase: false, delete: true };
    const workspace = await app.deps.workspaceService.updateProviderProjection(created.id, {
      execution_kind: "local",
      root_path: directory,
      provider_ref_json: { version: 1, data: { directory } },
      provider_capabilities_json: capabilities,
    });
    await mkdir(directory, { recursive: true });
    const localDirectory = createWorkspaceProviderDirectory(app.deps, {
      projectId: project.id,
      providerId: workspace!.provider_id,
      workspaceId: created.id,
    });
    (app.deps as WorkspacesRouteDeps).workspaceProviderRuntime = {
      find: async () => ({
        context: { localDirectory } as never,
        provider: {
          resolve: async () => {
            const target = await localDirectory();
            return {
              state: "ready",
              executionKind: "local",
              capabilities,
              executionTarget: { kind: "local", rootPath: target.path },
              providerRef: workspace!.provider_ref_json!,
            };
          },
        } as never,
      }),
    };
    const get = app.deps.workspaceService.get;
    let hold = true;
    app.deps.workspaceService.get = async (id) => {
      const row = await get(id);
      if (id === created.id && hold) {
        hold = false;
        entered.resolve();
        await release.promise;
      }
      return row;
    };
    recovery = reconcileProviderWorkspaces(app.deps, project.id);
    await entered.promise;
    deletion = deleteWorkspace(app.deps, workspace!, {
      deleteProviderBackedWorkspace: async () => {
        removedBeforeRecoveryFinished = !released;
        await rm(directory!, { recursive: true, force: true });
        removed.resolve();
        return true;
      },
      fireExtensionEventAsync: () => {},
    });
    await Promise.race([removed.promise, Bun.sleep(100)]);
    released = true;
    release.resolve();
    await Promise.all([recovery, deletion]);
    expect(removedBeforeRecoveryFinished).toBe(false);
    expect(existsSync(directory)).toBe(false);
    expect(Date.parse((await get(created.id))?.deleted_at ?? "")).not.toBeNaN();
  } finally {
    release.resolve();
    await Promise.allSettled([recovery, deletion]);
    try {
      await closeApp?.();
    } finally {
      if (previousHome === undefined) delete process.env.PSTDIO_HOME;
      else process.env.PSTDIO_HOME = previousHome;
      await rm(root, { recursive: true, force: true });
    }
  }
});

test.each([
  "direct",
  "already queued",
] as const)("a provision hook rejects its own deletion before joining a %s request", async (mode) => {
  const root = await mkdtemp(join(tmpdir(), "workspace-delete-own-hook-"));
  const directory = join(root, "workspace");
  await mkdir(directory);
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const requestDeletion = Promise.withResolvers<void>();
  let provisioning: Promise<void> | undefined;
  let externalDeletion: Promise<void> | undefined;
  let removed = false;
  let deletionError: unknown;
  try {
    const project = await app.deps.projectService.create({ name: "Provision hook deletion" });
    await app.deps.workspaceService.ensureDefault({ project_id: project.id, name: "Project folder", root_path: root });
    const created = await app.deps.workspaceService.create({
      project_id: project.id,
      shorthand_base: "HOOK",
      provider_id: "fixture.local",
      provider_state: "ready",
      root_path: directory,
    });
    const workspace = await app.deps.workspaceService.updateProviderProjection(created.id, {
      execution_kind: "local",
      provider_capabilities_json: { files: "write", diff: false, merge: false, rebase: false, delete: true },
    });
    const overrides = {
      deleteProviderBackedWorkspace: async () => {
        removed = true;
        await rm(directory, { recursive: true, force: true });
        return true;
      },
      fireExtensionEventAsync: () => {},
    };
    provisioning = provisionProjectWorkspaces(app.deps, project.id, {
      ensureConfig: async () => {},
      fireProvision: async (_deps, _projectId, _event, payload) => {
        if ((payload as { workspaceId: string }).workspaceId === created.id) {
          entered.resolve();
          await requestDeletion.promise;
          try {
            await deleteWorkspace(app.deps, workspace!, overrides);
          } catch (error) {
            deletionError = error;
          }
        }
        return { delivered: 0 };
      },
      fireReadyAsync: () => {},
    });
    await entered.promise;
    if (mode === "already queued") externalDeletion = deleteWorkspace(app.deps, workspace!, overrides);
    requestDeletion.resolve();
    await Promise.all([provisioning, externalDeletion]);
    expect(deletionError).toBeInstanceOf(Error);
    expect((deletionError as Error).message).toContain("cannot be nested");
    expect(removed).toBe(mode === "already queued");
    expect(existsSync(directory)).toBe(mode === "direct");
    expect(existsSync(root)).toBe(true);
    expect((await app.deps.workspaceService.get(created.id))?.setup_error).toBeNull();
  } finally {
    requestDeletion.resolve();
    await Promise.allSettled([provisioning, externalDeletion]);
    await app.close();
    await rm(root, { recursive: true, force: true });
  }
});
