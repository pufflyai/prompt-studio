import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestApp } from "../../test-utils/create-test-app";
import type { WorkspacesRouteDeps } from "./deps";
import { provisionProjectWorkspaces } from "./provision-coordinator";
import { deleteWorkspace } from "./workspace-deletion";
import { createWorkspaceProviderDirectory } from "./workspace-provider-directory";
import { reconcileProviderWorkspaces } from "./workspace-provider-reconciliation";

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
  const app = await createTestApp();
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  const removed = Promise.withResolvers<void>();
  let recovery: Promise<void> | undefined;
  let deletion: Promise<void> | undefined;
  let directory: string | undefined;
  let released = false;
  let removedBeforeRecoveryFinished = false;
  try {
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
    expect((await get(created.id))?.deleted_at).not.toBeNull();
  } finally {
    release.resolve();
    await Promise.allSettled([recovery, deletion]);
    await app.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
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
