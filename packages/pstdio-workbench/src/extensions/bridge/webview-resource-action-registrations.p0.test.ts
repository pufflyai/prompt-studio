import { expect, test } from "bun:test";
import type { WebviewResourceActionChoice } from "pstdio-api-contracts/extension-kernel";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import {
  createResourceViewerFixture,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { resolveMenuEntries } from "../../react/menus/menu-entries";
import { resolveResourceActionMenu } from "../../react/menus/resource-action-menu";
import { parseWebviewCapabilityParams } from "./webview-capability-params";
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

test("one scoped choice lease exposes checked rows and validates its choice before dispatch", async () => {
  const f = await setup();
  const choices = Array.from({ length: 40 }, (_, index) => ({
    id: String(index),
    label: `Version ${index}`,
    selected: index === 3,
    disabled: index === 4,
  }));
  await f.request({ ...f.action, label: "Versions", choices });
  const menu = resolveResourceActionMenu(f.w, viewerResource("x"))!;
  const rows = resolveMenuEntries({ ...menu, context: f.context });
  expect(rows).toHaveLength(40);
  expect(rows[3]).toMatchObject({
    label: "Version 3",
    selected: true,
    group: { label: "Versions", selectionMode: "single" },
  });
  expect(rows[4]?.disabled).toBe(true);
  await expect(f.w.commands.executeCommand(f.commandId(), { choiceId: "foreign" }, f.context)).rejects.toThrow(
    "disabled",
  );
  await expect(f.w.commands.executeCommand(f.commandId(), { choiceId: "4" }, f.context)).rejects.toThrow("disabled");
  const idleMenu = f.w.layout.menuStore.getState();
  const result = rows[3]!.run!();
  expect(f.w.layout.menuStore.getState()).not.toBe(idleMenu);
  expect(resolveMenuEntries({ ...menu, context: f.context })[3]?.disabled).toBe(true);
  const event = f.messages.at(-1)!.payload as { requestId: string };
  expect(event).toMatchObject({ choiceId: "3", registrationId: f.registrationId });
  // A preference refresh may change the checked row before the accepted callback completes.
  await f.request({
    operation: "update-choices",
    registrationId: f.registrationId,
    choices: choices.map((choice) => ({ ...choice, selected: choice.id === "5" })),
  });
  expect(resolveMenuEntries({ ...menu, context: f.context })[5]?.selected).toBe(true);
  const pendingMenu = f.w.layout.menuStore.getState();
  await f.request({ operation: "complete", requestId: event.requestId });
  await result;
  expect(f.w.layout.menuStore.getState()).not.toBe(pendingMenu);
  expect(resolveMenuEntries({ ...menu, context: f.context })[5]?.disabled).toBe(false);
  await f.request({ operation: "unregister", registrationId: f.registrationId });
  expect(resolveMenuEntries({ ...menu, context: f.context })).toEqual([]);
});

test("native choice input is bounded and cannot contain ambiguous identities or selection", async () => {
  const f = await setup();
  const parse = (choices: WebviewResourceActionChoice[]) =>
    parseWebviewCapabilityParams("resources.actions.register", { ...f.action, choices });
  expect(() =>
    parse([
      { id: "same", label: "One" },
      { id: "same", label: "Two" },
    ]),
  ).toThrow();
  expect(() =>
    parse([
      { id: "one", label: "One", selected: true },
      { id: "two", label: "Two", selected: true },
    ]),
  ).toThrow();
  expect(() => parse(Array.from({ length: 1025 }, (_, id) => ({ id: String(id), label: "Version" })))).toThrow();
  expect(() => parse([{ id: "page", label: "Next", kind: "action", selected: true }])).toThrow();
});

test("live choice updates preserve row identity and leave paging rows as ordinary actions", async () => {
  const f = await setup();
  const choices: WebviewResourceActionChoice[] = [
    { id: "saved", label: "Saved", selected: true },
    { id: "page", label: "Older versions", kind: "action", closeOnSelect: false },
  ];
  await f.request({ ...f.action, label: "Versions", choices });
  const menu = resolveResourceActionMenu(f.w, viewerResource("x"))!;
  const before = resolveMenuEntries({ ...menu, context: f.context });
  expect(before[1]).toMatchObject({ group: { label: "Versions" }, closeOnSelect: false });
  expect(before[1]?.group?.selectionMode).toBeUndefined();
  expect(before[1]?.selected).toBeUndefined();
  const other = await setup();
  await expect(
    other.request({ operation: "update-choices", registrationId: f.registrationId, choices }),
  ).rejects.toThrow("no longer available");
  await f.request({
    operation: "update-choices",
    registrationId: f.registrationId,
    label: "Revisions",
    choices: [{ id: "new", label: "Latest" }, ...choices],
  });
  const after = resolveMenuEntries({ ...menu, context: f.context });
  expect(after[1]?.id).toBe(before[0]?.id);
  expect(after[2]?.id).toBe(before[1]?.id);
  expect(after[1]?.group?.label).toBe("Revisions");
});

test("cancelling a choice when the menu becomes busy prevents guest execution", async () => {
  const f = await setup();
  await f.request({ ...f.action, choices: [{ id: "page", label: "Next" }] });
  const controller = new AbortController();
  const stop = f.w.layout.menuStore.subscribe(() => controller.abort());
  try {
    const result = f.w.commands.executeCommand(
      f.commandId(),
      { choiceId: "page" },
      {
        ...f.context,
        signal: controller.signal,
      },
    );
    await expect(result).rejects.toThrow("cancelled");
    expect(f.messages.map((message) => message.payload)).not.toContainEqual(
      expect.objectContaining({ type: "execute" }),
    );
  } finally {
    stop();
  }
});
