import { expect, test } from "bun:test";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import {
  createResourceViewerFixture,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { resolveMenuEntries } from "../../react/menus/menu-entries";
import { resolveResourceActionMenu } from "../../react/menus/resource-action-menu";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const setup = async () => {
  const fixture = createResourceViewerFixture();
  await fixture.openSide("x");
  const events = createHostEventPublisher();
  const messages: { payload: unknown }[] = [];
  events.bind((message) => messages.push(message));
  const placement = fixture.side();
  const capabilities = createWorkbenchWebviewHostCapabilities({
    workbench: fixture.w,
    placement,
    extensionId: "example.readers",
    projectId: "project",
    hostEvents: events,
  });
  const request = capabilities["resources.actions.register"];
  const registrationId = crypto.randomUUID();
  const action = {
    operation: "register" as const,
    registrationId,
    resource: viewerResource("x"),
    label: "Export HTML",
    icon: "download",
  };
  const context = { placement: placement.placementIdentity, resource: viewerResource("x"), projectId: "project" };
  const commandId = (id = registrationId) =>
    fixture.w.commands.listCommands().find((item) => item.command.id.endsWith(`.${id}`))!.command.id;
  const run = () => fixture.w.commands.executeCommand(commandId(), undefined, context);
  return { ...fixture, events, messages, capabilities, request, action, context, run, registrationId, commandId };
};

test("native resource menus dispatch only to their live captured view and await its result", async () => {
  const f = await setup();
  await f.request(f.action);
  const menu = resolveResourceActionMenu(f.w, viewerResource("x"))!;
  expect(resolveMenuEntries({ ...menu, context: f.context }).map((item) => item.label)).toContain("Export HTML");
  expect(resolveMenuEntries({ ...menu, context: { resource: viewerResource("x") } })).toEqual([]);
  const result = f.run();
  const event = f.messages.at(-1)!.payload as { requestId: string; registrationId: string };
  expect(event.registrationId).toBe(f.registrationId);
  await f.request({ operation: "complete", requestId: event.requestId, error: "Export unavailable" });
  await expect(result).rejects.toThrow("Export unavailable");
  const retry = f.run();
  const next = f.messages.at(-1)!.payload as { requestId: string };
  await f.request({ operation: "complete", requestId: next.requestId });
  await retry;
});

test("disconnect removes the menu and rejects pending work without replay on reconnect", async () => {
  const f = await setup();
  await f.request(f.action);
  const commandId = f.commandId();
  const result = f.run();
  f.events.unbind();
  await expect(result).rejects.toThrow("disconnected");
  expect(f.w.commands.getCommand(commandId)).toBeUndefined();
  const after: unknown[] = [];
  f.events.bind((message) => after.push(message));
  expect(after).toEqual([]);
});

test("registrations reject wrong resource, owner, project and stale view captures", async () => {
  const f = await setup();
  await expect(f.request({ ...f.action, resource: viewerResource("y") })).rejects.toThrow("own current");
  await expect(
    f.request({ ...f.action, resource: { ...viewerResource("x"), extensionId: "foreign" } }),
  ).rejects.toThrow("own current");
  f.w.pageLocations.setProject("another");
  await expect(f.request(f.action)).rejects.toThrow("project");
});

test("a delayed old registration cannot attach to the replacement resource", async () => {
  const f = await setup();
  await f.w.navigation.openTarget(
    { kind: "viewer", operation: "switch", from: viewerResource("x"), resource: viewerResource("y") },
    { viewer: f.context.placement, projectId: "project" },
  );
  const next = createWorkbenchWebviewHostCapabilities({
    workbench: f.w,
    placement: f.side(),
    extensionId: "example.readers",
    projectId: "project",
    hostEvents: f.events,
  });
  await expect(next["resources.actions.register"](f.action)).rejects.toThrow("own current");
  await expect(f.request(f.action)).rejects.toThrow("no longer open");
});

test("native cancellation aborts only its pending invocation and late replies are ignored", async () => {
  const f = await setup();
  await f.request(f.action);
  const controller = new AbortController();
  const result = f.w.commands.executeCommand(f.commandId(), undefined, {
    ...f.context,
    signal: controller.signal,
  });
  const event = f.messages.at(-1)!.payload as { requestId: string };
  controller.abort();
  await expect(result).rejects.toThrow("cancelled");
  expect(f.messages.at(-1)!.payload).toMatchObject({ type: "cancel", requestId: event.requestId });
  await f.request({ operation: "complete", requestId: event.requestId });
  expect(f.w.commands.isCommandEnabled(f.commandId(), undefined, f.context)).toBe(true);
});

test("old unregister leases cannot remove a new action and other frames cannot complete it", async () => {
  const f = await setup();
  await f.request(f.action);
  const newer = crypto.randomUUID();
  await f.request({ ...f.action, registrationId: newer });
  await f.request({ operation: "unregister", registrationId: f.registrationId });
  expect(f.w.commands.getCommand(f.commandId(newer))).toBeDefined();
  const other = await setup();
  const result = f.w.commands.executeCommand(f.commandId(newer), undefined, f.context);
  const event = f.messages.at(-1)!.payload as { requestId: string };
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await other.request({ operation: "complete", requestId: event.requestId });
  expect(settled).toBe(false);
  await f.request({ operation: "complete", requestId: event.requestId });
  await result;
});

test("two publishers in one workbench cannot collide using the same guest registration UUID", async () => {
  const f = await setup();
  await f.request(f.action);
  const firstId = f.commandId();
  const events = createHostEventPublisher();
  events.bind(() => {});
  const other = createWorkbenchWebviewHostCapabilities({
    workbench: f.w,
    placement: f.side(),
    extensionId: "example.readers",
    projectId: "project",
    hostEvents: events,
  })["resources.actions.register"];
  await other({ ...f.action, label: "Other export" });
  const commands = f.w.commands.listCommands().filter((item) => item.command.id.endsWith(`.${f.registrationId}`));
  expect(commands).toHaveLength(2);
  expect(new Set(commands.map((item) => item.command.id)).size).toBe(2);
  expect(f.w.commands.getCommand(firstId)?.command.label).toBe("Export HTML");
  const result = f.run();
  const event = f.messages.at(-1)!.payload as { requestId: string };
  let settled = false;
  void result.then(() => {
    settled = true;
  });
  await other({ operation: "complete", requestId: event.requestId });
  expect(settled).toBe(false);
  await f.request({ operation: "complete", requestId: event.requestId });
  await result;
  await other({ operation: "unregister", registrationId: f.registrationId });
  expect(f.w.commands.getCommand(firstId)).toBeDefined();
});
