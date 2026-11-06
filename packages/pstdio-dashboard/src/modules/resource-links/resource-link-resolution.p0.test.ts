import { expect, test } from "bun:test";
import { resourceKey } from "@pstdio/sdk/extensions";
import { createWorkbench, type WorkbenchModuleContext } from "@pstdio/workbench";
import { resolveLinkedResources } from "./resource-link-resolution";

test("keeps canonical identity when resolving a host resource", async () => {
  const ctx = createWorkbench();
  ctx.resources.registerProvider({
    id: "workspaces",
    kind: "workspace",
    list: () => [{ resource: { type: "workspace", id: "one", label: "WS-1" } }],
  });
  const ref = { type: "workspace", id: "one", projectId: "project", extensionId: "pstdio" };
  const result = await resolveLinkedResources(ctx as WorkbenchModuleContext, "project", [ref]);
  expect(resourceKey(result[0]!.resource)).toBe(resourceKey(ref));
});

test("resolves an owner batch once and keeps unavailable endpoints out", async () => {
  const { resolveOwnerBatch } = await import("./resource-link-resolution");
  const resources = ["one", "two", "missing"].map((id) => ({
    type: "note",
    id,
    extensionId: "notes",
    projectId: "project",
  }));
  let reads = 0;
  const result = await resolveOwnerBatch({
    resources,
    navigate: async () => {},
    resolve: async () => {
      reads += 1;
      return [
        { resource: { ...resources[0], label: "One" } },
        { resource: { ...resources[1], label: "Foreign", projectId: "other-project" } },
      ];
    },
  });
  expect(reads).toBe(1);
  expect(result.map((item) => item.resource.id)).toEqual(["one"]);
});

test("omits malformed owner presentation fields", async () => {
  const { resolveOwnerBatch } = await import("./resource-link-resolution");
  const resource = { type: "note", id: "one", extensionId: "notes", projectId: "project" };
  const result = await resolveOwnerBatch({
    resources: [resource],
    navigate: async () => {},
    resolve: async () => [{ resource: { ...resource, label: { text: "One" } } }],
  });
  expect(result).toEqual([]);
});

test("canonical sessions resolve through their installed public provider without a second host browse list", async () => {
  const { contributionRefId, sessionBrowser } = await import("@pstdio/sdk/extensions");
  const ctx = createWorkbench();
  ctx.pageLocations.setProject("project");
  const ref = { type: "session", id: "s", extensionId: "pstdio", projectId: "project" };
  const target = { kind: "page" as const, page: sessionBrowser.pages.session, resource: ref };
  const calls: unknown[] = [];
  const provider = ctx.commands.registerCommand(
    { id: contributionRefId(sessionBrowser.commands.resolve), label: "Resolve session" },
    {
      execute: (args, context) => {
        calls.push({ args, context });
        return [{ resource: ref, target }];
      },
    },
  );
  const result = await resolveLinkedResources(ctx as WorkbenchModuleContext, "project", [ref]);
  expect(result).toMatchObject([{ resource: ref, target }]);
  expect(calls).toMatchObject([{ args: { resources: [ref] }, context: { projectId: "project" } }]);
  provider.dispose();
  expect(await resolveLinkedResources(ctx as WorkbenchModuleContext, "project", [ref])).toEqual([]);
  expect(
    await resolveLinkedResources(ctx as WorkbenchModuleContext, "project", [{ ...ref, projectId: "foreign" }]),
  ).toEqual([]);
  expect(calls).toHaveLength(1);
});
