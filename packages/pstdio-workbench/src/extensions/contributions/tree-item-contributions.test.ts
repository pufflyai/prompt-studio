import { describe, expect, test } from "bun:test";
import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import { createWorkbenchCore } from "../../core";
import { emptyWorkbenchExtensionMetadata } from "./extension-contributions";
import { registerWorkbenchExtensionTreeItems } from "./tree-item-contributions";

type TreeItemAction = NonNullable<WorkbenchExtensionMetadata["treeItems"]>[number]["action"];

const treeItemMetadata = (action: TreeItemAction) => ({
  ...emptyWorkbenchExtensionMetadata,
  treeItems: [
    {
      id: "lab.tickets",
      extensionId: "pstdio.lab",
      target: "workbench.left.tree" as const,
      label: "Tickets",
      icon: "square-kanban",
      action,
    },
  ],
});

const treeItemNodes = async (metadata: ReturnType<typeof treeItemMetadata>) => {
  const workbench = createWorkbenchCore();
  registerWorkbenchExtensionTreeItems({
    metadata,
    workbench,
  });
  const renderer = workbench.renderers.getTreeRenderer("workbench.extension.treeItems.workbench.left.tree");
  const sections = await renderer?.getBody({});
  return sections?.flatMap((section) => section.nodes) ?? [];
};

describe("registerWorkbenchExtensionTreeItems", () => {
  test("maps a resource action onto a resource navigation target", async () => {
    const nodes = await treeItemNodes(
      treeItemMetadata({
        kind: "resource",
        resource: { type: "tickets-root", id: "tickets", label: "Tickets", metadata: { collection: "tickets" } },
      }),
    );

    expect(nodes[0]?.target).toEqual({
      kind: "resource",
      resource: {
        kind: "tickets-root",
        uri: "pstdio://extension-resource/tickets-root/tickets",
        id: "tickets",
        label: "Tickets",
        icon: "square-kanban",
        metadata: { collection: "tickets" },
      },
    });
  });

  test("keeps the href action on its host-owned command target", async () => {
    const nodes = await treeItemNodes(treeItemMetadata({ kind: "href", href: "https://example.com" }));

    expect(nodes[0]?.target).toEqual({
      kind: "command",
      commandId: "workbench.extension.href.lab.tickets",
      args: { href: "https://example.com" },
    });
  });
});
