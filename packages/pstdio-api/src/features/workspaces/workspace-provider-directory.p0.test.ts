import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInvocationScope } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "./deps";
import {
  createWorkspaceProviderDirectory,
  removeInactiveWorkspaceProviderDirectory,
} from "./workspace-provider-directory";

test("directory cleanup excludes active invocations until their resource cleanup finishes", async () => {
  const root = await mkdtemp(join(tmpdir(), "provider-directory-lifetime-"));
  const previousHome = process.env.PSTDIO_HOME;
  process.env.PSTDIO_HOME = root;
  const input = { workspaceId: "workspace", projectId: "project", providerId: "provider" };
  const deps = {
    workspaceService: {
      get: async () => ({
        id: input.workspaceId,
        project_id: input.projectId,
        provider_id: input.providerId,
        provider_operation_id: "operation",
        provider_operation_kind: "delete",
        provider_ref_json: null,
      }),
    },
  } as unknown as WorkspacesRouteDeps;
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const release = Promise.withResolvers<void>();
  const cleanupStarted = Promise.withResolvers<void>();
  try {
    const directory = await createWorkspaceProviderDirectory(deps, input, scope)();
    await directory.files.writeText("owned.txt", "owned");
    scope.register(async () => {
      cleanupStarted.resolve();
      await release.promise;
    });
    // Implicit process cwd resolution reuses the same scope after child cleanup registered.
    await createWorkspaceProviderDirectory(deps, input, scope)();
    const closing = scope.close();
    await cleanupStarted.promise;
    await expect(removeInactiveWorkspaceProviderDirectory(deps, input, "operation")).rejects.toThrow(/active/);
    expect(existsSync(directory.path)).toBe(true);
    release.resolve();
    await closing;
    await removeInactiveWorkspaceProviderDirectory(deps, input, "operation");
    expect(existsSync(directory.path)).toBe(false);
  } finally {
    release.resolve();
    await scope.close();
    if (previousHome === undefined) delete process.env.PSTDIO_HOME;
    else process.env.PSTDIO_HOME = previousHome;
    await rm(root, { recursive: true, force: true });
  }
});
