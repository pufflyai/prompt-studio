import { expect, test } from "bun:test";
import { createWorkbench, type ResourceRef } from "@pstdio/workbench";
import { registerDashboardNavigationContribution } from "./dashboard-navigation-contribution";

test("dashboard navigation only reads a resource when the contribution declares it", async () => {
  const workbench = createWorkbench();
  const owner = { kind: "mode", id: "project", extensionId: "pstdio" } as const;
  const reads: Array<ResourceRef | undefined> = [];
  registerDashboardNavigationContribution(workbench, {
    id: "static",
    modes: ["project"],
    getSections: (_ctx, { resource }) => {
      reads.push(resource);
      return [];
    },
  });
  registerDashboardNavigationContribution(workbench, {
    id: "workspace",
    modes: ["project"],
    resolveResource: ({ resource }) => (resource?.type === "workspace" ? resource : undefined),
    getSections: (_ctx, { resource }) => {
      reads.push(resource);
      return [];
    },
  });
  const animation = { type: "animation", id: "chat-turn" };
  const initial = workbench.navigationTrees.getReadKey(owner);
  expect(workbench.navigationTrees.getReadKey(owner, { resource: animation })).toBe(initial);
  await workbench.navigationTrees.getSections(owner, "content", { resource: animation });
  expect(reads).toEqual([undefined, undefined]);
  reads.length = 0;
  const workspace = { type: "workspace", id: "workspace-1" };
  expect(workbench.navigationTrees.getReadKey(owner, { resource: workspace })).not.toBe(initial);
  await workbench.navigationTrees.getSections(owner, "content", { resource: workspace });
  expect(reads).toEqual([undefined, workspace]);
});
