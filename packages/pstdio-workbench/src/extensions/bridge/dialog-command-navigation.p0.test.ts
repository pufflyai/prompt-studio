import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { createWorkbench } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { createExtensionWebviewHostCapabilities } from "./extension-webview-host-capabilities";
import { createWorkbenchExtensionWebviewAdapters } from "./webview-command-capabilities";

const setup = async () => {
  let rejectHistory = false;
  const workbench = createWorkbench({
    pageLocationBrowser: {
      current: () => ({ url: "/projects/project" }),
      push: () => {
        if (rejectHistory) throw new Error("Browser rejected navigation");
      },
      replace: () => {},
      back: () => {},
      forward: () => {},
      onPopState: () => ({ dispose() {} }),
    },
  });
  workbench.modes.registerMode({ id: "project", activate: () => undefined });
  workbench.views.registerView({ id: "content", title: "Content", body: { kind: "react", render: () => null } });
  const inspector = { kind: "placement" as const, extensionId: "acme.tools", id: "inspector" };
  workbench.modePlacements.registerPlacement({
    id: "inspector",
    ref: inspector,
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "content" }, presence: "closed" },
  });
  const source = { kind: "page" as const, id: "source", extensionId: "acme.tools" };
  const destination = { ...source, id: "destination" };
  const form = { ...source, id: "form" };
  for (const ref of [source, destination, form])
    workbench.pages.registerPage({
      id: ref.id,
      ref,
      title: ref.id,
      path: ref.id,
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "content" }, cardinality: "one", presentation: "page" },
      slots: [],
    });
  workbench.pageLocations.setProject("project");
  await workbench.navigation.openPage({ page: source });
  await workbench.navigation.openTarget({ kind: "dialog", page: form });
  const calling = toPanelInstance(workbench.layout.getLayout().regions.overlay.widgets[0]!);
  const commands = (target: NavigationTarget = { kind: "page", page: destination }, pending = Promise.resolve()) => {
    const adapters = createWorkbenchExtensionWebviewAdapters({
      executeCommand: async () => {
        await pending;
        return { outcome: { ok: true, status: "success", navigationRequests: [target] } };
      },
      extensionIdForWebview: () => "acme.tools",
      projectId: "project",
      slotKind: "panel",
    })({ workbench, placement: calling, webviewId: "form", hostEvents: createHostEventPublisher() });
    const capabilities = createExtensionWebviewHostCapabilities(adapters);
    return createHostCapabilityGate({ capabilities, declaredCapabilities: ["commands.execute", "navigation.open"] });
  };
  return { workbench, source, destination, form, inspector, commands, rejectHistory: () => (rejectHistory = true) };
};

test("a dialog command closes its source before navigation and cannot restore it when returning", async () => {
  const { workbench, source, destination, commands } = await setup();
  await commands().call({ method: "commands.execute", params: { commandId: "save" } });
  expect(workbench.pages.store.getState().location?.page).toEqual(destination);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
  await workbench.navigation.openPage({ page: source });
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([]);
});

test("a dialog command keeps its form when the browser rejects the destination", async () => {
  const { workbench, source, commands, rejectHistory } = await setup();
  const original = workbench.layout.getLayout().regions.overlay.widgets[0];
  rejectHistory();
  await commands().call({ method: "commands.execute", params: { commandId: "save" } });
  expect(workbench.pages.store.getState().location?.page).toEqual(source);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([original]);
});

test("a pending old dialog command cannot close or navigate a reopened form", async () => {
  const { workbench, source, form, commands } = await setup();
  const finish = Promise.withResolvers<void>();
  const pending = commands(undefined, finish.promise).call({
    method: "commands.execute",
    params: { commandId: "save" },
  });
  workbench.overlays.closeOverlay(workbench.layout.getLayout().regions.overlay.widgets[0]!.widgetId);
  await workbench.navigation.openTarget({ kind: "dialog", page: form });
  const reopened = workbench.layout.getLayout().regions.overlay.widgets[0];
  finish.resolve();
  await pending;
  expect(workbench.pages.store.getState().location?.page).toEqual(source);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([reopened]);
});

test("a rejected dialog command destination keeps its source form open", async () => {
  const { workbench, source, commands } = await setup();
  const original = workbench.layout.getLayout().regions.overlay.widgets[0];
  await commands({ kind: "page", page: { kind: "page", extensionId: "acme.tools", id: "missing" } }).call({
    method: "commands.execute",
    params: { commandId: "save" },
  });
  expect(workbench.pages.store.getState().location?.page).toEqual(source);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([original]);
});

test("a dialog command opening only Side retains its form and Main", async () => {
  const { workbench, source, inspector, commands } = await setup();
  const original = workbench.layout.getLayout().regions.overlay.widgets[0];
  await commands({ kind: "panel", panel: inspector, region: "side" }).call({
    method: "commands.execute",
    params: { commandId: "preview" },
  });
  expect(workbench.pages.store.getState().location?.page).toEqual(source);
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([original]);
  expect(workbench.layout.getLayout().regions.side.widgets).toHaveLength(1);
});

test("direct navigation does not implicitly dismiss the dialog", async () => {
  const { workbench, source, commands } = await setup();
  const original = workbench.layout.getLayout().regions.overlay.widgets[0];
  await commands().call({ method: "navigation.open", params: { target: { kind: "page", page: source } } });
  expect(workbench.layout.getLayout().regions.overlay.widgets).toEqual([original]);
});
