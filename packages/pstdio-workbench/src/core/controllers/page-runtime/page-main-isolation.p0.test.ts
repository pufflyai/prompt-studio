import { expect, test } from "bun:test";
import { modePanelFixture, pageRef } from "./mode-panel-state.fixture";

const fixture = (saved?: ReturnType<typeof modePanelFixture>["saved"]) => {
  const s = modePanelFixture(saved, true, [], "");
  const library = { kind: "placement", extensionId: "test", id: "library" } as const;
  const viewer = { kind: "placement", extensionId: "test", id: "artifact-viewer" } as const;
  s.w.views.registerView({ id: "library", title: "Artifacts", body: { kind: "react", render: () => null } });
  s.w.modePlacements.registerPlacement({
    id: "library",
    ref: library,
    modeId: "alpha",
    region: "main",
    addableIn: ["main"],
    item: { kind: "view", view: { kind: "view", id: "library" }, presence: "closed" },
  });
  s.w.modePlacements.registerPlacement({
    id: "artifact-viewer",
    ref: viewer,
    modeId: "alpha",
    region: "main",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "document" }],
        view: { kind: "view", id: "document" },
        cardinality: "many",
      },
    },
  });
  s.w.pages.registerPage({
    id: "artifacts",
    ref: pageRef("artifacts"),
    path: "artifacts",
    modeId: "alpha",
    main: { kind: "panels", landing: library },
    panelView: library,
    slots: [],
  });
  s.w.pages.registerPage({
    id: "artifact",
    ref: pageRef("artifact"),
    path: "artifacts/view",
    modeId: "alpha",
    parentId: "artifacts",
    resource: { kinds: [{ kind: "resource-kind", id: "document" }] },
    main: { kind: "panels", landing: viewer },
    slots: [],
  });
  s.w.pages.registerPage({
    id: "notes",
    ref: pageRef("notes"),
    path: "notes",
    modeId: "alpha",
    main: { kind: "panels" },
    slots: [
      {
        id: "note",
        region: "main",
        item: {
          kind: "binding",
          binding: {
            kinds: [{ kind: "resource-kind", id: "note" }],
            view: { kind: "view", id: "document" },
            cardinality: "many",
          },
        },
      },
    ],
  });
  s.w.pages.registerPage({
    id: "home",
    ref: pageRef("home"),
    path: "home",
    modeId: "alpha",
    main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one", presentation: "page" },
    slots: [],
  });
  return s;
};

test("each tabbed collection restores only its own Main tabs through other pages and reload", () => {
  const s = fixture();
  s.navigate("artifacts");
  s.navigate("artifact", "artifact-a");
  s.w.pinPlacement(s.w.layout.getActivePanel("main")!.placementIdentity!);
  const artifactTabs = s.w.layout.listPanelInstances("main").map((tab) => tab.instanceId);
  s.navigate("notes");
  expect(s.w.layout.listPanelInstances("main")).toEqual([]);
  s.w.pages.openSlot({ pageId: "notes", slotId: "note", resource: { type: "note", id: "note-a" }, open: "pin" });
  expect(s.ids("main")).toEqual(["note-a"]);
  expect(s.w.layout.listPanelInstances("main").map((tab) => tab.viewId)).toEqual(["document"]);
  const noteTab = s.w.layout.getActivePanel("main")!.instanceId;
  s.w.modePlacements.registerPlacement({
    id: "late-tool",
    ref: { kind: "placement", extensionId: "test", id: "late-tool" },
    modeId: "alpha",
    region: "side",
    item: { kind: "view", view: { kind: "view", id: "document" }, presence: "closed" },
  });
  expect(s.ids("main")).toEqual(["note-a"]);
  expect(s.w.layout.listPanelInstances("main").map((tab) => tab.viewId)).toEqual(["document"]);
  s.open("shared", "secondary", "pin");
  s.navigate("home");
  s.navigate("notes");
  expect(s.ids("main")).toEqual(["note-a"]);
  expect(s.w.layout.listPanelInstances("main").map((tab) => tab.viewId)).toEqual(["document"]);
  expect(s.w.layout.getActivePanel("main")!.instanceId).toBe(noteTab);
  s.navigate("artifacts");
  expect(s.w.layout.listPanelInstances("main").map((tab) => tab.instanceId)).toEqual(artifactTabs);
  expect(s.ids("secondary")).toEqual(["shared"]);
  const restored = fixture(s.saved);
  restored.navigate("notes");
  expect(restored.ids("main")).toEqual(["note-a"]);
  restored.navigate("artifacts");
  expect(restored.w.layout.listPanelInstances("main").map((tab) => tab.instanceId)).toEqual(artifactTabs);
  expect(restored.ids("secondary")).toEqual(["shared"]);
});

test("Main offers only this collection's page-associated panel views", () => {
  const s = fixture();
  s.navigate("notes");
  expect(s.w.composition.panelsFor("main").addable.map((panel) => panel.contribution.title)).not.toContain("Artifacts");
  s.navigate("artifacts");
  const library = s.w.layout.listPanelInstances("main").find((tab) => tab.viewId === "library")!;
  s.w.closePlacement(library.placementIdentity!);
  expect(s.w.composition.panelsFor("main").addable.map((panel) => panel.contribution.title)).toContain("Artifacts");
  s.navigate("artifact", "artifact-a");
  expect(s.w.composition.panelsFor("main").addable.map((panel) => panel.contribution.title)).toContain("Artifacts");
});
