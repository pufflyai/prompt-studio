import { expect, test } from "bun:test";
import { createWorkbench, getWorkbenchRenderers, type ResourceRef } from "../../core";
import type { TreeActionParamsRequest } from "../../react/renderers/tree/tree-actions";
import { toTreeListSection } from "../../react/renderers/tree/tree-list-adapter";
import { registerWorkbenchExtensionTreeRenderers } from "./tree-renderer-contributions";
import { metadata, treeId } from "./tree-renderer-contributions.fixture";

for (const subject of ["bound", "explicit", "unbound"] as const) {
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
    const sections = await getWorkbenchRenderers(workbench).getBody(treeId, { resource: stale });
    const requests: TreeActionParamsRequest[] = [];
    const adapted = toTreeListSection(
      sections[0]!,
      {},
      {
        workbench,
        resource: subject === "unbound" ? undefined : current,
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
