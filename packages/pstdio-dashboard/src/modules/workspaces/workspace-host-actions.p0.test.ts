import { expect, test } from "bun:test";
import type { DashboardWorkspaceOption } from "@/shared/workspaces/workspace-options";
import { canonicalWorkspaceHostResource } from "./workspace-host-actions";

const option: DashboardWorkspaceOption = {
  id: "one",
  title: "One",
  shorthand: "WS-1",
  branch: null,
  type: "folder",
  isDefault: false,
  executionKind: "local",
  providerState: "ready",
  supportsFiles: true,
  supportsDiff: false,
  supportsDelete: true,
  workspacePath: "/stale",
  updatedAt: "",
};
const row = {
  id: "one",
  projectId: "project",
  rootPath: "/live",
  executionKind: "local",
  providerState: "ready",
  initializing: false,
  setupError: null,
  capabilities: { files: "write" },
};
const resource = {
  type: "workspace",
  id: "one",
  projectId: "project",
  metadata: { workspacePath: "/private", workspaceExecutionKind: "local", workspaceProviderState: "ready" },
};

test("terminal and reveal use the live scoped target instead of caller path metadata", async () => {
  const result = await canonicalWorkspaceHostResource(resource, {
    projectId: "project",
    options: [option],
    get: async () => row as never,
  });
  expect(result.metadata?.workspacePath).toBe("/live");
  for (const change of [
    { projectId: "foreign" },
    { providerState: "failed" },
    { executionKind: "remote" },
    { initializing: true },
    { setupError: "failed" },
    { device: { id: "foreign", name: "Other", ownerId: "owner" } },
  ])
    await expect(
      canonicalWorkspaceHostResource(resource, {
        projectId: "project",
        options: [option],
        get: async () => ({ ...row, ...change }) as never,
      }),
    ).rejects.toThrow("unavailable");
  await expect(
    canonicalWorkspaceHostResource(
      { ...resource, projectId: "foreign" },
      {
        projectId: "project",
        options: [option],
        get: async () => {
          throw new Error("Must not fetch foreign project");
        },
      },
    ),
  ).rejects.toThrow("project");
});
