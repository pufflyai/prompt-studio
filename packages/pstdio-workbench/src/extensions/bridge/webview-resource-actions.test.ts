import { expect, test } from "bun:test";
import { createWorkbench, resourceContextMenuPath } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("webviews use the same current resource actions and command forms as native cards", async () => {
  const workbench = createWorkbench();
  const resource = { type: "ticket", id: "ticket-1", extensionId: "planner", projectId: "project-1" };
  let received: unknown;
  workbench.commands.registerCommand(
    { id: "run", label: "Run attempt", params: { model: { type: "text" } } },
    {
      execute: (_args, context) => {
        received = context?.resource;
      },
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), { id: "run-ticket", commandId: "run" });
  const capabilities = createWorkbenchWebviewHostCapabilities({
    workbench,
    extensionId: "planner",
    projectId: "project-1",
  });
  const actions = await capabilities["resources.actions"]({ operation: "list", resource });
  expect(actions).toMatchObject([{ key: "run-ticket", label: "Run attempt", isDisabled: false }]);
  await capabilities["resources.actions"]({ operation: "execute", resource, key: "run-ticket" });
  expect(workbench.commandPalette.store.getState().paramsRequest?.context?.resource).toEqual(resource);
  expect(received).toBeUndefined();
});

test("webviews cannot execute an action that is no longer available", async () => {
  const workbench = createWorkbench();
  let enabled = true;
  let calls = 0;
  workbench.commands.registerCommand(
    { id: "archive", label: "Archive" },
    {
      execute: () => {
        calls++;
      },
      isEnabled: () => enabled,
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), { id: "archive-ticket", commandId: "archive" });
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, projectId: "project-1" });
  const resource = { type: "ticket", id: "one" };
  await capabilities["resources.actions"]({ operation: "list", resource });
  enabled = false;
  await expect(
    capabilities["resources.actions"]({ operation: "execute", resource, key: "archive-ticket" }),
  ).rejects.toThrow();
  expect(calls).toBe(0);
});
