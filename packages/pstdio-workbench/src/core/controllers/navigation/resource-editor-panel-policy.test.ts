import { expect, test } from "bun:test";
import { harness, navigate, page, panel, resource } from "../composition/placement-lifecycle-test-support";

const setup = async () => {
  const core = harness(undefined, { regionSettings: { side: { canOpen: false, canClose: true } } });
  core.views.getView("editor")!.instancePolicy = "per-resource";
  core.modes.registerMode({ id: "review", activate() {} });
  core.pages.registerPage({
    id: "review",
    ref: page("review"),
    path: "review",
    modeId: "review",
    main: { kind: "panels", empty: { kind: "view", id: "empty" } },
    slots: [],
  });
  await core.navigation.openTarget(navigate("alpha"));
  const target = { kind: "panel" as const, panel, resource: resource("a"), open: "pin" as const };
  await core.navigation.openTarget(target);
  return { core, target };
};

test("compound navigation rejects a hidden editor even when a later target leaves its owner", async () => {
  const { core, target } = await setup();
  try {
    await core.shell.setRegionOpen("side", false);
    const before = core.layout.getLayout();
    await expect(
      core.navigation.openTarget({
        kind: "compound",
        targets: [target, { kind: "page", page: page("review") }],
      }),
    ).rejects.toThrow("cannot open: side");
    expect(core.pages.store.getState().location?.resource?.id).toBe("alpha");
    expect(core.layout.getLayout()).toBe(before);
  } finally {
    await core.dispose();
  }
});

test("an existing editor remains reusable when its visible panel does not accept new tabs", async () => {
  const { core, target } = await setup();
  try {
    core.modes.getMode("edit")!.regionSettings = { side: { acceptsTabs: false } };
    const original = core.layout.getLayout().activeWidgetId;
    await core.navigation.openTarget(target);
    expect(core.layout.getLayout().activeWidgetId).toBe(original);
    expect(core.layout.listPanelInstances("side")).toHaveLength(1);
  } finally {
    await core.dispose();
  }
});

for (const collection of [true, false]) {
  test(`editor reuse reads the saved Bottom policy from an ${collection ? "unbound document collection" : "unbound resource-less page"}`, async () => {
    const core = harness();
    core.views.getView("editor")!.instancePolicy = "per-resource";
    core.pages.registerPage({
      id: "documents",
      ref: page("documents"),
      path: "documents",
      parentId: "workspace",
      modeId: "edit",
      ...(collection ? { resource: { kinds: [{ kind: "resource-kind" as const, id: "file" }] } } : {}),
      main: collection
        ? { kind: "view", view: { kind: "view", id: "empty" }, cardinality: "many" }
        : { kind: "panels", empty: { kind: "view", id: "empty" } },
      regionSettings: { bottom: { canOpen: false, canClose: true } },
      slots: [
        {
          id: "inspector",
          region: "bottom",
          item: {
            kind: "binding",
            binding: {
              kinds: [{ kind: "resource-kind", id: "file" }],
              view: { kind: "view", id: "editor" },
              cardinality: "many",
            },
          },
        },
      ],
    });
    const target = {
      kind: "panel" as const,
      panel: { kind: "page-slot" as const, page: page("documents"), id: "inspector" },
      resource: resource("b"),
      open: "pin" as const,
    };
    try {
      await core.navigation.openTarget({
        kind: "page",
        page: page("documents"),
        ...(collection ? { resource: resource("a") } : {}),
      });
      await core.navigation.openTarget(target);
      await core.shell.setRegionOpen("bottom", false);
      await core.navigation.openTarget(navigate("alpha"));
      const before = core.layout.getLayout();
      await expect(
        core.navigation.openTarget({ kind: "compound", targets: [target, navigate("beta")] }),
      ).rejects.toThrow("cannot open: bottom");
      expect(core.pages.store.getState().location?.resource?.id).toBe("alpha");
      expect(core.layout.getLayout()).toBe(before);
    } finally {
      await core.dispose();
    }
  });
}
