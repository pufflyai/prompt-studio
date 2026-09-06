import { expect, test } from "bun:test";
import { createHostCapabilityGate } from "pstdio-extensions/bridge/contract";
import { createWorkbench } from "../../core";
import { toPanelInstance } from "../../core/registries/layout/panel-api";
import { createWorkbenchWebviewHostCapabilities } from "./webview-host-capabilities";

const setup = () => {
  const workbench = createWorkbench();
  const page = { kind: "page" as const, id: "notes", extensionId: "acme.notes" };
  workbench.modes.registerMode({ id: "review", activate: () => undefined });
  workbench.views.registerView({ id: "notes", title: "Notes", body: { kind: "react", render: () => null } });
  workbench.pages.registerPage({
    id: "notes",
    ref: page,
    title: "Notes",
    path: "notes",
    modeId: "review",
    main: { kind: "panels", empty: { kind: "view", id: "notes" } },
    slots: ["editor", "inspector"].map((id) => ({
      id,
      region: "side",
      item: { kind: "view", view: { kind: "view", id: "notes" }, presence: "open" },
    })),
  });
  workbench.pageLocations.setProject("project-1");
  workbench.pageLocations.navigate({ kind: "page", page });
  const calling = workbench.layout.getLayout().regions.side.widgets[0]!;
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, placement: toPanelInstance(calling) });
  return { workbench, capabilities };
};

test("a declared close capability closes only its calling placement and preserves the route", async () => {
  const { workbench, capabilities } = setup();
  const location = workbench.pages.store.getState().location;
  const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["placement.close"] });
  await gate.call({ method: "placement.close" });
  expect(workbench.layout.getLayout().regions.side.widgets.map((item) => item.placementIdentity)).toEqual([
    { kind: "page", pageId: "notes", slotId: "inspector", instanceKey: "default" },
  ]);
  expect(workbench.pages.store.getState().location).toEqual(location);
});

test("close requires a declaration and rejects a caller-supplied placement identity", async () => {
  const { workbench, capabilities } = setup();
  const before = workbench.pages.store.getState();
  const undeclared = createHostCapabilityGate({ capabilities });
  await expect(undeclared.call({ method: "placement.close" })).rejects.toThrow("did not declare");
  const declared = createHostCapabilityGate({ capabilities, declaredCapabilities: ["placement.close"] });
  await expect(declared.call({ method: "placement.close", params: { placementId: "inspector" } })).rejects.toThrow(
    "takes no parameters",
  );
  expect(workbench.pages.store.getState()).toBe(before);
});

test("native close and webview close enforce fixed placements and the last resource parent rule", async () => {
  const { workbench } = setup();
  const home = workbench.pages.getPage("notes")!;
  const resourcePage = { ...home.ref, id: "note" };
  workbench.pages.registerPage({
    id: "note",
    ref: resourcePage,
    title: "Note",
    path: "note",
    modeId: "review",
    parentId: home.id,
    resource: { kinds: [{ kind: "resource-kind", id: "note" }] },
    main: { kind: "view", view: { kind: "view", id: "notes" }, cardinality: "one" },
    slots: [],
  });
  workbench.pageLocations.navigate({ kind: "page", page: resourcePage, resource: { type: "note", id: "one" } });
  const calling = toPanelInstance(workbench.layout.getLayout().regions.main.widgets[0]!);
  const capabilities = createWorkbenchWebviewHostCapabilities({ workbench, placement: calling });
  const gate = createHostCapabilityGate({ capabilities, declaredCapabilities: ["placement.close"] });
  await gate.call({ method: "placement.close" });
  expect(workbench.pages.store.getState().location?.page).toEqual(home.ref);
  const fixed = workbench.layout.getLayout().regions.main.widgets[0]!;
  expect(() => workbench.closePlacement(fixed.placementIdentity!)).toThrow("fixed");
});
