import { expect, test } from "bun:test";
import { defaultPageResourceCodec } from "@pstdio/sdk/extensions";
import { harness, navigate, openFile, page, panel, resource } from "../composition/placement-lifecycle-test-support";

test("a low-level reopen refreshes the title when resource normalization preserves its reference", async () => {
  const w = harness(undefined, { pageResources: { ...defaultPageResourceCodec, normalize: (resource) => resource } });
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
  await w.navigation.openTarget({
    kind: "panel",
    panel: { kind: "shell-placement", id: "inspector" },
    resource: resource("a"),
    title: "Old title",
    open: "pin",
  });
  const tab = w.layout
    .getLayout()
    .regions.secondary.widgets.find((tab) => tab.widgetId === w.layout.getLayout().activeWidgetId)!;
  const reopened = w.layout.openPanel(tab.contributionId, { resource: tab.resource, title: "New title" });
  expect(reopened.instanceId).toBe(tab.widgetId);
  expect(reopened.title).toBe("New title");
  expect(w.layout.getActivePanel()?.title).toBe("New title");
});

for (const policy of [undefined, "per-resource"] as const) {
  test.each([
    "page",
    "mode",
    "shell",
    "transferred",
  ] as const)(`reopening a %s editor refreshes its resource with policy ${policy}`, async (owner) => {
    const w = harness();
    w.views.getView("editor")!.instancePolicy = policy;
    await w.navigation.openTarget(navigate("alpha"));
    if (owner === "shell")
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
    const bases = {
      shell: { kind: "panel" as const, panel: { kind: "shell-placement" as const, id: "inspector" } },
      mode: { kind: "panel" as const, panel },
      page: openFile("a"),
      transferred: openFile("a"),
    };
    const base = bases[owner];
    const target = (label: string, path: string) => ({
      ...base,
      resource: { ...resource("a"), label, metadata: { path } },
      open: "pin" as const,
      ...(owner === "shell" ? { title: `Custom ${label}` } : {}),
    });
    await w.navigation.openTarget(target("Old name", "a.ts"));
    const initialId = w.layout.getLayout().activeWidgetId!;
    if (owner === "transferred") w.movePanel(initialId, "side");
    await w.navigation.openTarget(target("New name", "renamed.ts"));
    expect(w.layout.getLayout().activeWidgetId).toBe(initialId);
    if (owner === "shell") expect(w.layout.getActivePanel()?.title).toBe("Custom New name");
    expect(w.layout.getActivePanel()?.resource).toEqual({
      ...resource("a"),
      label: "New name",
      metadata: { path: "renamed.ts" },
    });
  });
}

test("a compound reopen refreshes a transferred editor even when its owner becomes inactive", async () => {
  const w = harness();
  w.views.getView("editor")!.instancePolicy = "per-resource";
  await w.navigation.openTarget(navigate("alpha"));
  await w.navigation.openTarget(openFile("a"));
  const tabId = w.layout.getLayout().activeWidgetId!;
  w.movePanel(tabId, "side");
  await w.navigation.openTarget({
    kind: "compound",
    targets: [{ ...openFile("a"), resource: { ...resource("a"), label: "New name" } }, navigate("beta")],
  });
  await w.navigation.openTarget(navigate("alpha"));
  expect(w.layout.getLayout().regions.side.widgets.find((p) => p.widgetId === tabId)?.resource?.label).toBe("New name");
});

for (const policy of [undefined, "per-resource"] as const) {
  for (const initialOpen of ["pin", "preview"] as const) {
    test(`a persistent Main reopen preserves its instance and requested title from ${initialOpen} with policy ${policy ?? "omitted"}`, async () => {
      const w = harness();
      w.views.getView("editor")!.instancePolicy = policy;
      w.pages.registerPage({
        id: "documents",
        ref: page("documents"),
        path: "documents",
        modeId: "edit",
        parentId: "workspace",
        resource: { kinds: [{ kind: "resource-kind", id: "file" }] },
        main: { kind: "view", view: { kind: "view", id: "editor" }, cardinality: "many" },
        slots: [],
      });
      await w.navigation.openTarget({
        kind: "page",
        page: page("documents"),
        parent: navigate("alpha"),
        resource: { ...resource("a"), label: "Old name" },
        open: initialOpen,
      });
      const tab = w.layout.getActivePanel()!;
      const updatedResource = { ...resource("a"), label: "New name", metadata: { path: "new.ts" } };
      const reopened = w.layout.openPanel(tab.panelId, {
        resource: updatedResource,
        title: "New title",
        strategy: { kind: "persistent" },
      });
      expect(reopened.instanceId).toBe(tab.instanceId);
      expect(reopened.resource).toEqual(updatedResource);
      expect(reopened.title).toBe("New title");
      expect(w.layout.getActivePanel()?.title).toBe("New title");
      if (policy === "per-resource") expect(w.pages.store.getState().location?.resource).toEqual(updatedResource);
    });
  }
}

for (const policy of [undefined, "per-resource"] as const) {
  for (const initialOpen of ["preview", "pin"] as const) {
    test(`a persistent page slot reopen keeps its explicit title from ${initialOpen} with policy ${policy ?? "omitted"}`, async () => {
      const w = harness();
      w.views.getView("editor")!.instancePolicy = policy;
      await w.navigation.openTarget(navigate("alpha"));
      await w.navigation.openTarget({ ...openFile("a"), open: initialOpen });
      const tab = w.layout.getActivePanel()!;
      const updatedResource = { ...tab.resource!, label: "New name" };
      const reopened = w.layout.openPanel(tab.panelId, {
        resource: updatedResource,
        title: "New title",
        strategy: { kind: "persistent" },
      });
      expect(reopened.instanceId).toBe(tab.instanceId);
      expect(reopened.resource).toEqual(updatedResource);
      expect(reopened.title).toBe("New title");
      expect(w.layout.getActivePanel()?.title).toBe("New title");
    });
  }
}
