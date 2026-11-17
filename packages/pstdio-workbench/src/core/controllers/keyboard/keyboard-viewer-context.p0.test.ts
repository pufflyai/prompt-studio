import { expect, test } from "bun:test";
import { executeWorkbenchExtensionCommandResponse } from "../../../extensions/host/workbench-extension-command";
import { createResourceViewerFixture, viewerResource } from "../resource-viewers/resource-viewer-test-fixture";

test("Current view passes the chosen placement to an extension command's captured viewer", async () => {
  const { w, openSide, side } = createResourceViewerFixture();
  await openSide("x");
  const original = side();
  const location = w.pages.store.getState().location;
  const contexts: unknown[] = [];
  w.commands.registerCommand(
    { id: "switch-record", label: "Switch record" },
    {
      execute: (_args, context) => {
        contexts.push(context?.placement);
        return executeWorkbenchExtensionCommandResponse(
          {
            workbench: w,
            projectId: "project",
            executeCommand: async () => ({
              outcome: {
                status: "success",
                navigationRequests: [
                  {
                    kind: "viewer",
                    operation: "switch",
                    from: context?.resource,
                    resource: viewerResource("y"),
                  },
                ],
              },
            }),
          },
          "switch-record",
          { placement: context?.placement, resource: context?.resource },
        );
      },
    },
  );
  w.keybindings.registerKeybinding({
    id: "switch-record",
    layer: "current",
    targetScope: "panel",
    keybinding: "S",
    when: 'workbench.resource.id == "x"',
    action: { kind: "command", commandId: "switch-record" },
  });
  w.keyboard.open();
  await w.keyboard.press("a");
  await w.keyboard.press("s");
  expect(contexts).toEqual([original.placementIdentity]);
  expect(side().resource?.id).toBe("y");
  expect(side().instanceId).toBe(original.instanceId);
  expect(w.pages.store.getState().location).toBe(location);
  w.dispose();
});
