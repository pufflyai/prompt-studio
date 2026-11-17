import { expect, test } from "bun:test";
import { realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createInvocationScope } from "pstdio-extensions";
import type { WorkspacesRouteDeps } from "./deps";
import { createWorkspaceProviderProcess } from "./workspace-provider-process";

const deps = {
  workspaceService: {
    getDefault: async () => null,
    get: async () => ({ project_id: "foreign", provider_id: "other" }),
  },
} as unknown as WorkspacesRouteDeps;

test("project-only provider callbacks can run tools in an explicit local directory", async () => {
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const process = createWorkspaceProviderProcess(deps, { projectId: "project", providerId: "provider" }, scope);
  const cwd = await realpath(tmpdir());
  try {
    const result = await process.runOrThrow({ cwd, command: ["bun", "-e", "process.stdout.write(process.cwd())"] });
    expect(result.stdout).toBe(cwd);
  } finally {
    await scope.close();
  }
});

test("explicit process directories retain workspace ownership checks", async () => {
  const scope = createInvocationScope({ logger: { info() {}, warn() {}, error() {} } });
  const process = createWorkspaceProviderProcess(
    deps,
    { projectId: "project", providerId: "provider", workspaceId: "foreign" },
    scope,
  );
  try {
    await expect(
      process.runOrThrow({ cwd: tmpdir(), command: ["bun", "-e", "process.stdout.write('unexpected')"] }),
    ).rejects.toThrow(/does not own/);
  } finally {
    await scope.close();
  }
});
