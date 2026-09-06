import { expect, test } from "bun:test";
import { createWorkbench, type ResourceRef, resourceContextMenuPath } from "../../../core";
import { createTreeContextMenuItems, type TreeActionParamsRequest } from "./tree-actions";

test("keeps the clicked resource when command parameters are submitted after the active resource changes", async () => {
  const workbench = createWorkbench();
  const clicked: ResourceRef = { kind: "ticket", id: "clicked", uri: "pstdio://ticket/clicked" };
  let requested: TreeActionParamsRequest | undefined;
  let renamed: { resource?: ResourceRef; args: unknown } | undefined;
  workbench.commands.registerCommand(
    { id: "rename", label: "Rename", params: { name: { type: "text", label: "Name" } } },
    {
      execute: (args, context) => {
        renamed = { resource: context?.resource, args };
      },
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), { commandId: "rename" });
  const items = createTreeContextMenuItems({
    workbench,
    menuPath: resourceContextMenuPath("ticket"),
    context: { resource: clicked },
    onRequestParams: (request) => {
      requested = request;
    },
  });
  items[0]?.onAction?.();
  expect(requested?.request.context?.resource).toEqual(clicked);
  workbench.context.set("workbench.resource.kind", "workspace");
  workbench.context.set("workbench.resource.id", "other");
  await requested?.run({ name: "Updated" });
  expect(renamed).toEqual({ resource: clicked, args: { name: "Updated" } });
});
