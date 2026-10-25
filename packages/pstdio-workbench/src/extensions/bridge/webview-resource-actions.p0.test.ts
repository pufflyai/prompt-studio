import { expect, test } from "bun:test";
import { RESOURCE_ACTIONS_EVENTS_SCOPE } from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench, resourceContextMenuPath } from "../../core";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

test("webviews use the same current resource actions and command forms as native cards", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-1");
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
  workbench.pageLocations.setProject("project-1");
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

test("webviews receive the failure of an action they execute", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.setProject("project-1");
  workbench.commands.registerCommand(
    { id: "archive", label: "Archive" },
    {
      execute: () => {
        throw new Error("Archive failed");
      },
    },
  );
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), { id: "archive-ticket", commandId: "archive" });
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, projectId: "project-1" });
  await expect(
    capabilities["resources.actions"]({
      operation: "execute",
      resource: { type: "ticket", id: "one" },
      key: "archive-ticket",
    }),
  ).rejects.toThrow("Archive failed");
});

test("webviews list the menu item's own icon and the reason it is disabled", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-1");
  workbench.commands.registerCommand({ id: "archive", label: "Archive", icon: "Trash" }, { execute: () => {} });
  workbench.layout.registerMenuItem(resourceContextMenuPath("ticket"), {
    id: "archive-ticket",
    commandId: "archive",
    icon: "Archive",
    readOnly: true,
    disabledReason: "Close the ticket first.",
  });
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, projectId: "project-1" });
  expect(
    await capabilities["resources.actions"]({ operation: "list", resource: { type: "ticket", id: "one" } }),
  ).toMatchObject([
    { key: "archive-ticket", icon: "Archive", isDisabled: true, description: "Close the ticket first." },
  ]);
});

test("webview resource actions do not attribute a resource to the calling extension", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-1");
  workbench.commands.registerCommand({ id: "open", label: "Open" }, { execute: () => {} });
  workbench.layout.registerMenuItem(resourceContextMenuPath("session"), {
    id: "open-lab-session",
    commandId: "open",
    when: "workbench.resource.extensionId == pstdio.lab",
  });
  const capabilities = createWorkbenchWebviewHostCapabilities({
    workbench,
    extensionId: "pstdio.lab",
    projectId: "project-1",
  });
  expect(
    await capabilities["resources.actions"]({ operation: "list", resource: { type: "session", id: "one" } }),
  ).toEqual([]);
});

test("webviews hear when listed resource actions may have changed until they disconnect", async () => {
  const workbench = createWorkbench();
  workbench.pageLocations.setProject("project-1");
  const hostEvents = createHostEventPublisher();
  const events: unknown[] = [];
  hostEvents.bind((event) => events.push(event));
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, projectId: "project-1", hostEvents });
  await capabilities["resources.actions"]({ operation: "list", resource: { type: "ticket", id: "one" } });
  workbench.context.set("ticket.status", "done");
  await Promise.resolve();
  expect(events).toEqual([{ scope: RESOURCE_ACTIONS_EVENTS_SCOPE, payload: { type: "changed" } }]);
  hostEvents.unbind();
  hostEvents.bind((event) => events.push(event));
  workbench.context.set("ticket.status", "open");
  await Promise.resolve();
  expect(events).toHaveLength(1);
});
