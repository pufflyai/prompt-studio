import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers, type ResourceRef } from "../../core";
import type { TreeActionParamsRequest } from "../../react/renderers/tree/tree-actions";
import { toTreeListSection } from "../../react/renderers/tree/tree-list-adapter";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

for (const subject of ["bound", "explicit", "unbound", "composed"] as const) {
  test(`retained tree actions use the ${subject} resource captured when activated`, async () => {
    const workbench = createWorkbench();
    const resource = (path: string): ResourceRef => ({
      type: "workspace",
      id: "workspace",
      projectId: "project-1",
      metadata: { workspaceFilePath: path },
    });
    const stale = resource("assets/LICENSE");
    const current = resource("generated/zzz-folder/keep.txt");
    const explicit = resource("another-row.md");
    const calls: Array<{ resource: unknown; rendererResource: unknown }> = [];
    const action = {
      id: "rename",
      label: "Rename",
      command: { kind: "command" as const, id: "rename" },
      input: { name: { type: "text" as const, label: "Name" } },
    };
    workbench.registerModule({
      id: "test.retained-tree-resource",
      activate: (context) =>
        registerWorkbenchExtensionTreeRenderers({
          executeCommand: (id, body) => {
            if (id !== "pstdio.lab.tree.body") {
              calls.push({
                resource: body.resource,
                rendererResource: (body.params?.renderer as { resource?: unknown } | undefined)?.resource,
              });
              return;
            }
            return [
              {
                id: "files",
                actions: [action],
                nodes: [
                  {
                    id: "folder",
                    label: "Folder",
                    contextMenuActions: [action],
                    ...(subject === "explicit" ? { resource: explicit } : {}),
                  },
                ],
              },
            ];
          },
          metadata,
          projectId: "project-1",
          workbench: context,
        }),
    });
    const owner = { kind: "page", extensionId: "pstdio.lab", id: "ticket" } as const;
    workbench.navigationTrees.registerContribution({
      id: "ticket-files",
      owner,
      sourceExtensionId: "pstdio.lab",
      declarationIndex: 0,
      viewId: treeId,
    });
    const sections =
      subject === "composed"
        ? await workbench.navigationTrees.getSections(owner, "content", { resource: current })
        : await getWorkbenchRenderers(workbench).getBody(treeId, { resource: stale });
    const requests: TreeActionParamsRequest[] = [];
    const adapted = toTreeListSection(
      sections[0]!,
      {},
      {
        workbench,
        resource: subject === "unbound" || subject === "composed" ? undefined : current,
        onRequestParams: (request) => requests.push(request),
      },
    );
    adapted.nodes[0]?.contextMenuItems?.[0]?.onAction?.();
    adapted.actions[0]?.onAction?.({ sectionId: "files" });
    // Another placement and later active selection cannot retarget either pending input.
    toTreeListSection(sections[0]!, {}, { workbench, resource: resource("other-placement.md") });
    workbench.context.set("workbench.resource.id", "unrelated");
    expect(requests).toHaveLength(2);
    for (const request of requests) await request.run({ name: "Renamed" });
    const sectionResource = subject === "unbound" ? undefined : current;
    const rowResource = subject === "explicit" ? explicit : sectionResource;
    expect(calls).toEqual([
      { resource: rowResource, rendererResource: rowResource },
      { resource: sectionResource, rendererResource: sectionResource },
    ]);
  });
}

test("merged navigation sections preserve an explicitly resource-less row owner", async () => {
  const workbench = createWorkbench();
  const owner = { kind: "page", extensionId: "example", id: "page" } as const;
  const bound: ResourceRef = { type: "ticket", id: "bound" };
  const calls: unknown[] = [];
  for (const [index, resource] of [bound, undefined].entries()) {
    workbench.navigationTrees.registerContribution({
      id: `contribution-${index}`,
      owner,
      sourceExtensionId: "example",
      declarationIndex: index,
      resolveResource: () => resource,
      getSections: () => [
        {
          id: "merged",
          nodes: [
            {
              id: `row-${index}`,
              label: `Row ${index}`,
              actions: [
                {
                  id: "inspect",
                  label: "Inspect",
                  run: (_args, context) => {
                    calls.push(context?.resource);
                  },
                },
              ],
            },
          ],
        },
      ],
    });
  }
  try {
    const sections = await workbench.navigationTrees.getSections(owner, "content", { resource: bound });
    expect(sections).toHaveLength(1);
    const adapted = toTreeListSection(sections[0]!, {}, { workbench });
    adapted.nodes[0]?.actions?.[0]?.onAction?.({ nodeId: "row-0" });
    adapted.nodes[1]?.actions?.[0]?.onAction?.({ nodeId: "row-1" });
    await Bun.sleep(0);
    expect(calls).toEqual([bound, undefined]);
  } finally {
    await workbench.dispose();
  }
});

for (const projected of ["bound", "unbound"] as const) {
  test(`projected ${projected} navigation actions keep their owner in a bound tree`, async () => {
    const workbench = createWorkbench();
    const owner = { kind: "page", extensionId: "example", id: "page" } as const;
    const placement: ResourceRef = { type: "ticket", id: "placement" };
    const resource: ResourceRef | undefined =
      projected === "bound" ? { type: "workspace", id: "contribution" } : undefined;
    const calls: unknown[] = [];
    const action = {
      id: "inspect",
      label: "Inspect",
      run: (_args: unknown, context?: { resource?: ResourceRef }) => {
        calls.push(context?.resource);
      },
    };
    workbench.navigationTrees.registerContribution({
      id: "projected",
      owner,
      sourceExtensionId: "example",
      declarationIndex: 0,
      resolveResource: () => resource,
      getSections: () => [{ id: "files", actions: [action], nodes: [{ id: "row", label: "Row", actions: [action] }] }],
    });
    try {
      const sections = await workbench.navigationTrees.getSections(owner, "content", { resource: placement });
      const adapted = toTreeListSection(sections[0]!, {}, { workbench, resource: placement });
      adapted.nodes[0]?.actions?.[0]?.onAction?.({ nodeId: "row" });
      adapted.actions[0]?.onAction?.({ sectionId: "files" });
      await Bun.sleep(0);
      expect(calls).toEqual([resource, resource]);
    } finally {
      await workbench.dispose();
    }
  });
}
