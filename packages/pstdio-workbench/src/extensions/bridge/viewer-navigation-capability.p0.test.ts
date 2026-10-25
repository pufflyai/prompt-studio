import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { resourceContextMenuPath } from "../../core";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerResource,
} from "../../core/controllers/resource-viewers/resource-viewer-test-fixture";
import { executeWorkbenchExtensionCommandResponse } from "../host/workbench-extension-command";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const target = (from: string, to: string) => ({
  kind: "viewer" as const,
  operation: "switch" as const,
  from: viewerResource(from),
  resource: viewerResource(to),
});
const setup = async () => {
  const fixture = createResourceViewerFixture();
  await fixture.openSide("x");
  const capabilities = createWorkbenchWebviewHostCapabilities({
    workbench: fixture.w,
    placement: fixture.side(),
    extensionId: "example.readers",
    projectId: "project",
  });
  const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["navigation.open"] });
  return { ...fixture, capabilities, gate };
};

test("webview navigation changes its captured viewer and keeps Main unchanged", async () => {
  const { w, gate, side } = await setup();
  const location = w.pages.store.getState().location;
  await gate.call({ method: "navigation.open", params: { target: target("x", "y") } });
  expect(side().resource?.id).toBe("y");
  expect(w.pages.store.getState().location).toBe(location);
});

test("webview resource actions can switch their calling viewer", async () => {
  const { w, side, capabilities } = await setup();
  w.commands.registerCommand(
    { id: "switch", label: "Switch" },
    {
      execute: (_args, context) =>
        w.navigation.openTarget(target("x", "y"), {
          viewer: context?.placement,
          projectId: context?.projectId,
        }),
    },
  );
  w.layout.registerMenuItem(resourceContextMenuPath("record"), { id: "switch", commandId: "switch" });
  await capabilities["resources.actions"]({ operation: "execute", resource: viewerResource("x"), key: "switch" });
  expect(side().resource?.id).toBe("y");
});

test("a webview command cannot run in a project different from its captured project", async () => {
  const { w, capabilities } = await setup();
  let ran = false;
  w.commands.registerCommand(
    { id: "inspect", label: "Inspect" },
    {
      execute: () => {
        ran = true;
      },
    },
  );
  w.pageLocations.setProject("another");
  await expect(capabilities["commands.execute"]({ commandId: "inspect" })).rejects.toThrow("project");
  expect(ran).toBe(false);
});

test("webview commands use their viewer resource when the request omits a subject", async () => {
  const { w, side, capabilities } = await setup();
  w.commands.registerCommand(
    { id: "switch", label: "Switch" },
    {
      execute: (_args, context) =>
        w.navigation.openTarget(
          {
            ...target("x", "y"),
            from: context?.resource,
          },
          { viewer: context?.placement, projectId: context?.projectId },
        ),
    },
  );
  await capabilities["commands.execute"]({ commandId: "switch" });
  expect(side().resource?.id).toBe("y");
});

test("viewer navigation requires its capability and rejects caller-supplied owner identities", async () => {
  const { w, capabilities, gate, side } = await setup();
  const undeclared = createHostCapabilityGate({ capabilities });
  await expect(undeclared.call({ method: "navigation.open", params: { target: target("x", "y") } })).rejects.toThrow(
    "did not declare",
  );
  await expect(
    gate.call({
      method: "navigation.open",
      params: { target: { ...target("x", "y"), placementIdentity: { kind: "mode", placementId: "someone-else" } } },
    }),
  ).rejects.toMatchObject({ code: "invalid_params" });
  expect(side().resource?.id).toBe("x");
  const noCaller = createHostCapabilityGate({
    capabilities: createWorkbenchWebviewHostCapabilities({ workbench: w }),
    declaredCapabilities: ["navigation.open"],
  });
  await expect(noCaller.call({ method: "navigation.open", params: { target: target("x", "y") } })).rejects.toThrow(
    "calling viewer",
  );
});

test("a command's viewer navigation applies to its captured caller after the command finishes", async () => {
  const { w, openSide, side } = await setup();
  const caller = side();
  await openSide("other");
  await executeWorkbenchExtensionCommandResponse(
    {
      projectId: "project",
      workbench: w,
      executeCommand: async () => ({
        outcome: {
          ok: true,
          status: "success",
          navigationRequests: [{ ...target("x", "created"), operation: "replace" }],
        },
      }),
    },
    "create",
    { placement: caller.placementIdentity },
  );
  expect(side().resource?.id).toBe("other");
  expect(
    w.layout.listPanelInstances("side").find((panel) => panel.instanceId === caller.instanceId)?.resource?.id,
  ).toBe("created");
});

test("an old webview callback cannot affect a replacement owner after its captured viewer closes", async () => {
  const { w, gate, side, openSide } = await setup();
  w.closePlacement(side().placementIdentity!);
  await openSide("new");
  await gate.call({
    method: "navigation.open",
    params: { target: { ...target("x", "created"), operation: "replace" } },
  });
  expect(side().resource?.id).toBe("new");
  expect(w.layout.listPanelInstances("side")).toHaveLength(1);
});

test("an aborted creation cannot navigate its viewer when a late command result arrives", async () => {
  const { w, side } = await setup();
  const controller = new AbortController();
  await executeWorkbenchExtensionCommandResponse(
    {
      projectId: "project",
      workbench: w,
      executeCommand: async () => {
        controller.abort();
        return {
          outcome: { status: "success", navigationRequests: [{ ...target("x", "created"), operation: "replace" }] },
        };
      },
    },
    "create",
    { placement: side().placementIdentity, signal: controller.signal },
  );
  expect(side().resource?.id).toBe("x");
});

test("navigation command targets preserve the invoking viewer for command-result replacement", async () => {
  const { w, gate, side } = await setup();
  w.commands.registerCommand(
    { id: "example.readers.command.create", label: "Create" },
    {
      execute: (_, context) =>
        executeWorkbenchExtensionCommandResponse(
          {
            projectId: "project",
            workbench: w,
            executeCommand: async () => ({
              outcome: { status: "success", navigationRequests: [{ ...target("x", "created"), operation: "replace" }] },
            }),
          },
          "create",
          { placement: context?.placement },
        ),
    },
  );
  await gate.call({
    method: "navigation.open",
    params: {
      target: {
        kind: "command",
        target: { command: { kind: "command", extensionId: "example.readers", id: "create" } },
      },
    },
  });
  expect(side().resource?.id).toBe("created");
});

test("a captured landing replacement cannot cross to another project's identical landing", async () => {
  const { w, other } = createResourceViewerFixture();
  other();
  const identity = w.pages.getContent()!.placementIdentity!;
  w.pageLocations.setProject("other-project");
  other();
  await expect(
    w.navigation.openTarget(
      { kind: "viewer", operation: "replace", page: viewerPage("reader"), resource: viewerResource("created") },
      { viewer: identity, projectId: "project" },
    ),
  ).rejects.toThrow("project");
  expect(w.pages.store.getState().location?.page).toEqual(viewerPage("other"));
  expect(w.pages.getContent()?.resource).toBeUndefined();
});

test("command results ignore an intervening target deletion while a fresh creation can reuse its identity", async () => {
  const { w, side } = await setup();
  const run = (remove: boolean) =>
    executeWorkbenchExtensionCommandResponse(
      {
        projectId: "project",
        workbench: w,
        executeCommand: async () => {
          if (remove) w.resources.removed(viewerResource("created"));
          return {
            outcome: { status: "success", navigationRequests: [{ ...target("x", "created"), operation: "replace" }] },
          };
        },
      },
      "create",
      { placement: side().placementIdentity },
    );
  await run(true);
  expect(side().resource?.id).toBe("x");
  await run(false);
  expect(side().resource?.id).toBe("created");
});

test("an extension command cannot replace a reopened instance of its caller", async () => {
  const { w, openSide, side } = await setup();
  const caller = side();
  let finish!: (value: unknown) => void;
  const result = executeWorkbenchExtensionCommandResponse(
    {
      projectId: "project",
      workbench: w,
      executeCommand: () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    },
    "create",
    { placement: caller.placementIdentity },
  );
  w.closePlacement(caller.placementIdentity!);
  await openSide("x");
  finish({ outcome: { status: "success", navigationRequests: [{ ...target("x", "created"), operation: "replace" }] } });
  await result;
  expect(side().resource?.id).toBe("x");
});

test("an old webview frame cannot switch a reopened instance of its caller", async () => {
  const { w, openSide, side, gate } = await setup();
  w.closePlacement(side().placementIdentity!);
  await openSide("x");
  await gate.call({ method: "navigation.open", params: { target: target("x", "y") } });
  expect(side().resource?.id).toBe("x");
});

for (const method of ["commands.execute", "resources.actions"] as const) {
  test(`an old frame cannot execute ${method} against its reopened caller`, async () => {
    const { w, openSide, side, capabilities } = await setup();
    let calls = 0;
    w.commands.registerCommand(
      { id: "inspect", label: "Inspect" },
      {
        execute: () => {
          calls++;
        },
      },
    );
    w.layout.registerMenuItem(resourceContextMenuPath("record"), { id: "inspect", commandId: "inspect" });
    w.closePlacement(side().placementIdentity!);
    await openSide("x");
    const request =
      method === "commands.execute"
        ? capabilities[method]({ commandId: "inspect" })
        : capabilities[method]({ operation: "execute", resource: viewerResource("x"), key: "inspect" });
    await expect(request).rejects.toThrow("viewer");
    expect(calls).toBe(0);
  });
}

test("adapters created for an already closed caller remain stale after it reopens", async () => {
  const { w, openSide, side } = await setup();
  const caller = side();
  w.closePlacement(caller.placementIdentity!);
  const closed = createWorkbenchWebviewHostCapabilities({
    workbench: w,
    placement: caller,
    extensionId: "example.readers",
    projectId: "project",
  });
  await openSide("x");
  await closed["navigation.open"]({ target: target("x", "y") });
  expect(side().resource?.id).toBe("x");
});

test("static panels also keep capture lifetimes separate across reopen", async () => {
  const { w } = createResourceViewerFixture();
  const panel = { ...viewerPage("browser"), kind: "placement" as const };
  w.modePlacements.registerPlacement({
    id: "browser",
    ref: panel,
    modeId: "project",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "browser" }, presence: "closed" },
  });
  const identity = w.modePlacements.openPlacement({ panel });
  const invocation = w.viewers.captureContext(identity);
  expect(invocation.isViewerCurrent?.()).toBe(true);
  w.closePlacement(identity);
  w.modePlacements.openPlacement({ panel });
  expect(invocation.isViewerCurrent?.()).toBe(false);
  expect(w.viewers.captureContext(identity).isViewerCurrent?.()).toBe(true);
});

test("a generic resource-action parameter dialog keeps its original viewer guard", async () => {
  const { w, openSide, side, capabilities } = await setup();
  let calls = 0;
  w.commands.registerCommand(
    { id: "rename", label: "Rename", params: { name: { type: "string", label: "Name" } } },
    {
      execute: () => {
        calls++;
      },
    },
  );
  w.layout.registerMenuItem(resourceContextMenuPath("record"), { id: "rename", commandId: "rename" });
  await capabilities["resources.actions"]({ operation: "execute", resource: viewerResource("x"), key: "rename" });
  const request = w.commandPalette.store.getState().paramsRequest!;
  w.closePlacement(side().placementIdentity!);
  await openSide("x");
  await expect(w.commands.executeCommand("rename", { name: "Renamed" }, request.context)).rejects.toThrow("viewer");
  expect(calls).toBe(0);
});
