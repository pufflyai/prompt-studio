import { expect, test } from "bun:test";
import { createWorkbench } from "../../workbench-core";
import {
  createResourceViewerFixture,
  viewerPage,
  viewerPanel,
  viewerResource,
} from "../resource-viewers/resource-viewer-test-fixture";

const registerReader = (w: ReturnType<typeof createWorkbench>, id = "reader") =>
  w.modePlacements.registerPlacement({
    id,
    ref: { ...viewerPanel, id },
    modeId: "project",
    region: "side",
    item: {
      kind: "binding",
      binding: {
        view: { kind: "view", id: "reader" },
        kinds: [{ kind: "resource-kind", extensionId: "example.readers", id: "record" }],
        cardinality: "many",
      },
    },
  });

const fixture = async (second = false) => {
  const first = createResourceViewerFixture();
  first.other();
  await first.openSide("saved");
  if (second) {
    registerReader(first.w, "second");
    await first.w.navigation.openPanel({
      panel: { ...viewerPanel, id: "second" },
      resource: viewerResource("second"),
      open: "pin",
    });
  }
  const saved = first.saved;
  await first.w.dispose();
  const w = createWorkbench({
    layoutPersistence: {
      getLayout: (scope) => saved.get(scope),
      setLayout: (layout, scope) => saved.set(scope, structuredClone(layout)),
      listLayouts: () => [...saved].map(([scope, layout]) => ({ scope, layout })),
    },
  });
  w.modes.registerMode({ id: "project", activate() {} });
  w.views.registerView({ id: "browser", title: "Core page", body: { kind: "react", render: () => null } });
  w.pages.registerPage({
    id: "other",
    ref: viewerPage("other"),
    path: "other",
    modeId: "project",
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "browser" } },
    slots: [],
  });
  w.pageLocations.setProject("project");
  w.pageLocations.navigate({ kind: "page", page: viewerPage("other") });
  w.views.registerView({ id: "reader", title: "Late provider", body: { kind: "react", render: () => null } });
  const register = (id = "reader") => registerReader(w, id);
  const side = () => w.layout.listPanelInstances("side");
  return { w, register, side };
};

test("a saved Side tab restores when its independent provider registers after a core page", async () => {
  const s = await fixture();
  expect(s.side()).toHaveLength(0);
  const owner = s.register();
  expect(s.side().map((tab) => tab.resource?.id)).toEqual(["saved"]);
  owner.dispose();
  expect(s.side()).toHaveLength(0);
  s.register();
  expect(s.side().map((tab) => tab.resource?.id)).toEqual(["saved"]);
  await s.w.dispose();
});

test("closing a registered Side tab remains authoritative when its provider returns", async () => {
  const s = await fixture();
  const owner = s.register();
  const identity = s.side()[0].placementIdentity!;
  s.w.modePlacements.closePlacement(identity);
  expect(s.side()).toHaveLength(0);
  owner.dispose();
  s.register();
  expect(s.side()).toHaveLength(0);
  await s.w.dispose();
});

test("resetting the layout clears saved tabs of an unavailable provider", async () => {
  const s = await fixture();
  s.w.resetLayout();
  s.register();
  expect(s.side()).toHaveLength(0);
  await s.w.dispose();
});

test("resource removal clears an unavailable provider's saved Side tab", async () => {
  const s = await fixture();
  s.w.resources.removed(viewerResource("saved"));
  s.register();
  expect(s.side()).toHaveLength(0);
  await s.w.dispose();
});

test("a delayed provider does not restore another project's Side state", async () => {
  const s = await fixture();
  s.w.pageLocations.setProject("another-project");
  s.w.pageLocations.navigate({ kind: "page", page: viewerPage("other") });
  s.register();
  expect(s.side()).toHaveLength(0);
  await s.w.dispose();
});

test.each([
  "restore",
  "activate",
  "keyboard",
] as const)("late owners restore saved selection while respecting an explicit visible choice (%s)", async (choice) => {
  const s = await fixture(true);
  s.register();
  expect(s.w.layout.getActivePanel("side")?.resource?.id).toBe("saved");
  if (choice === "activate") s.w.layout.activatePanel(s.side()[0].instanceId);
  if (choice === "keyboard") {
    s.w.layout.setRegionVisible("side", true);
    s.w.keyboard.open();
    s.w.keyboard.selectPresentation(s.side()[0].instanceId);
  }
  s.register("second");
  expect(s.side().map((tab) => tab.resource?.id)).toEqual(["saved", "second"]);
  expect(s.w.layout.getActivePanel("side")?.resource?.id).toBe(choice === "restore" ? "second" : "saved");
  await s.w.dispose();
});
