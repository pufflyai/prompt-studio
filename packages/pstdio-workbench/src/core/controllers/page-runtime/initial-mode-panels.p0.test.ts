import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";

const fixture = (projectOnNavigation = false) => {
  const w = createWorkbench();
  w.views.registerView({ id: "document", title: "Document", body: { kind: "react", render: () => null } });
  for (const modeId of ["alpha", "beta"]) {
    w.modes.registerMode({ id: modeId, activate() {} });
    w.pages.registerPage({
      id: modeId,
      ref: { kind: "page", extensionId: "test", id: modeId },
      path: modeId,
      modeId,
      main: { kind: "view", view: { kind: "view", id: "document" }, cardinality: "one" },
      slots: [],
    });
  }
  w.shellPlacements.registerPlacement({
    id: "document",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "document" },
        kinds: [{ kind: "resource-kind", id: "document" }],
        cardinality: "many",
      },
    },
  });
  if (!projectOnNavigation) w.pageLocations.setProject("project");
  const navigate = (id: string) => {
    if (projectOnNavigation) w.pageLocations.setProject("project");
    return w.pageLocations.navigate({
      kind: "page",
      page: { kind: "page", extensionId: "test", id },
    });
  };
  const open = () =>
    w.navigation.openTarget({
      kind: "panel",
      panel: { kind: "shell-placement", id: "document" },
      resource: { type: "document", id: "one" },
      open: "pin",
    });
  return { w, navigate, open };
};

test.each([
  true,
  false,
])("first page preserves a close and an explicit opening attaches Side; project on navigation=%s", async (projectOnNavigation) => {
  const s = fixture(projectOnNavigation);
  s.w.sidePanel.setMode("closed");
  s.w.shell.setRegionSize("side", 417);
  s.navigate("alpha");
  expect(s.w.sidePanel.getMode()).toBe("closed");
  expect(s.w.shell.getRegionState("side").size).toBe(417);
  await s.open();
  expect(s.w.sidePanel.getMode()).toBe("attached");
});

test("opening into an empty floating Side preserves its presentation, including a mode return", async () => {
  const s = fixture();
  s.navigate("alpha");
  expect(s.w.sidePanel.getMode()).toBe("floating");
  await s.open();
  expect(s.w.sidePanel.getMode()).toBe("floating");
  s.navigate("beta");
  s.w.sidePanel.setMode("attached");
  s.navigate("alpha");
  expect(s.w.sidePanel.getMode()).toBe("floating");
});

test("a fresh mode uses its defaults instead of inheriting the preceding mode's close", () => {
  const s = fixture();
  s.w.sidePanel.setMode("closed");
  s.navigate("alpha");
  s.navigate("beta");
  expect(s.w.sidePanel.getMode()).toBe("floating");
  s.navigate("alpha");
  expect(s.w.sidePanel.getMode()).toBe("closed");
});
