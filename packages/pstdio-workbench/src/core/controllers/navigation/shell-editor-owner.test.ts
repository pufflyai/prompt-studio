import { expect, test } from "bun:test";
import { harness, navigate, openFile, page, resource } from "../composition/placement-lifecycle-test-support";
import { openOwnerLayouts } from "../page-runtime/open-owner-layouts";

const target = {
  kind: "panel" as const,
  panel: { kind: "shell-placement" as const, id: "inspector" },
  resource: resource("a"),
  open: "pin" as const,
};
const setup = async () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  w.shellPlacements.registerPlacement({
    id: "inspector",
    region: "secondary",
    item: {
      kind: "binding",
      binding: {
        kinds: [{ kind: "resource-kind", id: "file" }],
        view: { kind: "view", id: "editor" },
        cardinality: "many",
      },
    },
  });
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(target);
  return w;
};

test("a compound shell reopen followed by another workspace succeeds", async () => {
  const w = await setup();
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget({ kind: "compound", targets: [target, navigate("beta")] });
  expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
  expect(
    openOwnerLayouts(w).filter((o) =>
      Object.values(o.layout.regions).some((r) => r.widgets.some((t) => t.widgetId === id)),
    ),
  ).toHaveLength(1);
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
});

test("a shell editor in an inactive workspace activates its saved owner", async () => {
  const w = await setup();
  const id = w.layout.getLayout().activeWidgetId;
  await w.navigation.openTarget(navigate("beta"));
  await w.navigation.openTarget(target);
  expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
  expect(w.layout.getLayout().activeWidgetId).toBe(id);
  expect(w.focus.getActiveRegion()).toBe("secondary");
  expect(
    openOwnerLayouts(w).filter((o) =>
      Object.values(o.layout.regions).some((r) => r.widgets.some((t) => t.widgetId === id)),
    ),
  ).toHaveLength(1);
});

test("separate shell reopen and workspace navigation succeeds", async () => {
  const w = await setup();
  await w.navigation.openTarget(target);
  await w.navigation.openTarget(navigate("beta"));
  expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
});

for (const compound of [false, true]) {
  test(`shell editor refresh remains in its owner after ${compound ? "compound" : "separate"} mode navigation`, async () => {
    const w = await setup();
    const id = w.layout.getLayout().activeWidgetId;
    w.modes.registerMode({ id: "review", activate() {} });
    w.pages.registerPage({
      id: "review",
      ref: page("review"),
      modeId: "review",
      path: "review",
      main: { kind: "panels", empty: { kind: "view", id: "empty" } },
      slots: [],
    });
    const refreshed = {
      ...target,
      resource: { ...resource("a"), label: "new", metadata: { path: "new.ts" } },
      title: "new",
    };
    const end = { kind: "page" as const, page: page("review") };
    if (compound) await w.navigation.openTarget({ kind: "compound", targets: [refreshed, end] });
    else {
      await w.navigation.openTarget(refreshed);
      await w.navigation.openTarget(end);
    }
    expect(w.pages.store.getState().activePageId).toBe("review");
    const owners = openOwnerLayouts(w).filter((o) =>
      Object.values(o.layout.regions).some((r) => r.widgets.some((t) => t.widgetId === id)),
    );
    expect(owners).toHaveLength(1);
    await w.navigation.openTarget(refreshed);
    expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
    expect(w.layout.getLayout().activeWidgetId).toBe(id);
    const tab = w.layout.getActivePanel();
    expect(tab?.title).toBe("new");
    expect(tab?.resource?.label).toBe("new");
    expect(tab?.resource?.metadata?.path).toBe("new.ts");
  });
}

test("a later Main editor receives focus after a shell reopen in another owner", async () => {
  const w = await setup();
  await w.navigation.openTarget({ kind: "compound", targets: [target, navigate("beta"), openFile("b")] });
  expect(w.pages.store.getState().location?.resource?.id).toBe("beta");
  expect(w.layout.getActivePanel()?.resource?.id).toBe("b");
  expect(w.focus.getActiveRegion()).toBe("main");
});

test("an unavailable shell owner rejects before changing the current page", async () => {
  const w = await setup();
  w.modes.registerMode({ id: "review", activate() {} });
  w.pages.registerPage({
    id: "review",
    ref: page("review"),
    modeId: "review",
    path: "review",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  await w.navigation.openTarget({ kind: "page", page: page("review") });
  w.modes.getMode("edit")!.panels = ["main"];
  const state = w.pages.store.getState();
  const layout = w.layout.getLayout();
  const owners = JSON.stringify(openOwnerLayouts(w));
  await expect(w.navigation.openTarget({ kind: "compound", targets: [target, navigate("beta")] })).rejects.toThrow(
    "cannot open",
  );
  expect(w.pages.store.getState()).toBe(state);
  expect(w.layout.getLayout()).toBe(layout);
  expect(JSON.stringify(openOwnerLayouts(w))).toBe(owners);
});

for (const owner of ["page", "shell"] as const) {
  test(`a fresh staged ${owner} editor restores its validated owner ancestry`, async () => {
    const w = harness();
    w.views.getView("editor")!.instancePolicy = "per-resource";
    w.pages.registerPage({
      id: "collection",
      ref: page("collection"),
      modeId: "edit",
      path: "collection",
      main: { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "one" },
      slots: [],
    });
    w.shellPlacements.registerPlacement({
      id: "inspector",
      region: "secondary",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "file" }],
          view: { kind: "view", id: "editor" },
          cardinality: "many",
        },
      },
    });
    const open = owner === "shell" ? target : { ...openFile("a"), open: "pin" as const };
    await w.navigation.openTarget({
      kind: "compound",
      targets: [
        { ...navigate("alpha"), parent: { kind: "page", page: page("collection") } },
        open,
        navigate("beta"),
        open,
      ],
    });
    expect(w.pages.store.getState().location?.resource?.id).toBe("alpha");
    expect(w.pages.store.getState().location?.parent?.page.id).toBe("collection");
    expect(w.layout.getActivePanel()?.resource?.id).toBe("a");
    expect(w.focus.getActiveRegion()).toBe(owner === "shell" ? "secondary" : "main");
    const instances = openOwnerLayouts(w).flatMap((o) =>
      Object.values(o.layout.regions).flatMap((r) =>
        r.widgets.filter((t) => t.viewId === "editor" && t.resource?.id === "a"),
      ),
    );
    expect(instances).toHaveLength(1);
  });
}
