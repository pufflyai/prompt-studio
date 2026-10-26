import { expect, test } from "bun:test";
import {
  createResourceViewerFixture,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { placementMenuActions } from "./placement-menu-actions";

test("a menu built before resource deletion cannot reopen its removed target", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft", "draft");
  const actions = placementMenuActions(
    w,
    {
      menu: [
        {
          id: "resources",
          rows: [
            {
              id: "created",
              label: "Created",
              action: {
                kind: "navigation",
                target: {
                  kind: "viewer",
                  operation: "switch",
                  from: viewerResource("draft", "draft"),
                  resource: viewerResource("created"),
                },
              },
            },
          ],
        },
      ],
    },
    side().resource,
    w.layout.getLayout().regions.side.widgets[0],
  );
  w.resources.removed(viewerResource("created"));
  await actions[0]!.onClick?.();
  await Promise.resolve();
  expect(side().resource?.id).toBe("draft");
});

for (const deferred of [false, true]) {
  test(`a menu command keeps its original caller guard (parameter dialog: ${deferred})`, async () => {
    const { w, openSide, side } = createResourceViewerFixture();
    await openSide("draft", "draft");
    const caller = side();
    let calls = 0;
    w.commands.registerCommand(
      { id: "create", label: "Create", ...(deferred ? { params: { name: { type: "string", label: "Name" } } } : {}) },
      {
        execute: () => {
          calls++;
        },
      },
    );
    const [action] = placementMenuActions(
      w,
      {
        menu: [
          {
            id: "actions",
            rows: [{ id: "create", label: "Create", action: { kind: "command", commandId: "create" } }],
          },
        ],
      },
      caller.resource,
      w.layout.getLayout().regions.side.widgets[0],
    );
    if (deferred) await action!.onClick?.();
    w.closePlacement(caller.placementIdentity!);
    await openSide("draft", "draft");
    if (deferred) {
      const request = w.commandPalette.store.getState().paramsRequest!;
      await expect(w.commands.executeCommand("create", { name: "New" }, request.context)).rejects.toThrow("viewer");
    } else {
      await action!.onClick?.();
      await Promise.resolve();
    }
    expect(calls).toBe(0);
  });
}

test("a native resource-action parameter dialog keeps its original viewer guard", async () => {
  const { createWorkbenchResourceActions } = await import("../menus/resource-actions");
  const { resourceContextMenuPath } = await import("../../core");
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("draft", "draft");
  let calls = 0;
  w.commands.registerCommand(
    { id: "rename", label: "Rename", params: { name: { type: "string", label: "Name" } } },
    {
      execute: () => {
        calls++;
      },
    },
  );
  w.layout.registerMenuItem(resourceContextMenuPath("draft"), { id: "rename", commandId: "rename" });
  const [action] = createWorkbenchResourceActions(w, viewerResource("draft", "draft"), {
    context: { placement: side().placementIdentity },
  });
  await action!.onClick?.();
  const request = w.commandPalette.store.getState().paramsRequest!;
  w.closePlacement(side().placementIdentity!);
  await openSide("draft", "draft");
  await expect(w.commands.executeCommand("rename", { name: "Renamed" }, request.context)).rejects.toThrow("viewer");
  expect(calls).toBe(0);
});
