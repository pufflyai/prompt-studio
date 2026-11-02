import { expect, test } from "bun:test";
import { workbenchPages } from "@pstdio/sdk/extensions";
import { createWorkbench } from "../../workbench-core";
import { modePanelFixture } from "../page-runtime/mode-panel-state.fixture";
import { createMemoryWorkbenchPageLocationBrowser } from "./page-location-memory";

const draftPanel = { kind: "placement", extensionId: "test", id: "drafts" } as const;
const registerDrafts = (fixture: ReturnType<typeof modePanelFixture>) =>
  fixture.w.modePlacements.registerPlacement({
    id: "drafts",
    ref: draftPanel,
    modeId: "alpha",
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
const openDraft = (fixture: ReturnType<typeof modePanelFixture>) =>
  fixture.w.modePlacements.openPlacement({
    panel: draftPanel,
    resource: { type: "document", id: "unsent", projectId: "project" },
    open: "pin",
  });

test("boot without the configured default restores the mode's shared panels", () => {
  const first = modePanelFixture(undefined, true, [], "");
  registerDrafts(first);
  first.w.modes.setActiveMode("alpha");
  first.w.pageLocations.navigateToRootLevel();
  expect(first.w.modes.getActiveModeId()).toBe("alpha");
  openDraft(first);
  first.w.shell.setRegionOpen("side", true);
  first.w.shell.setRegionSize("side", 480);
  const retained = first.w.layout.listPanelInstances("side")[0]!;

  const restored = modePanelFixture(first.saved, true, [], "");
  registerDrafts(restored);
  restored.w.modes.setActiveMode("alpha");
  restored.w.pageLocations.boot("project");

  expect(restored.w.pages.store.getState().location).toBeUndefined();
  expect(restored.w.modes.getActiveModeId()).toBe("alpha");
  expect(restored.ids("side")).toEqual(["unsent"]);
  expect(restored.w.layout.listPanelInstances("side")[0]?.instanceId).toBe(retained.instanceId);
  expect(restored.w.layout.getLayout().regions.side).toMatchObject({ visible: true, size: 480 });
});

test("an unavailable default restores only the selected project's shared panels", () => {
  const fixture = modePanelFixture(undefined, true, [], "");
  registerDrafts(fixture);
  fixture.w.modes.setActiveMode("alpha");
  fixture.w.pageLocations.navigateToRootLevel();
  openDraft(fixture);
  fixture.w.shell.setRegionOpen("side", true);

  fixture.w.pageLocations.switchProject("other");
  expect(fixture.w.pages.store.getState().projectId).toBe("other");
  expect(fixture.w.modes.getActiveModeId()).toBe("alpha");
  expect(fixture.ids("side")).toEqual([]);

  fixture.w.pageLocations.switchProject("project");
  expect(fixture.w.pages.store.getState().projectId).toBe("project");
  expect(fixture.ids("side")).toEqual(["unsent"]);
});

test("saved and available default destinations choose their own mode on project switches", () => {
  const fixture = modePanelFixture();
  fixture.navigate("beta");
  fixture.w.pageLocations.switchProject("other");
  fixture.navigate("alpha");
  fixture.w.pageLocations.switchProject("project");
  expect(fixture.w.pages.store.getState().location?.page.id).toBe("beta");
  expect(fixture.w.modes.getActiveModeId()).toBe("beta");

  fixture.w.pages.registerPage({
    id: "start",
    ref: workbenchPages.start,
    path: "start",
    modeId: "beta",
    main: { kind: "panels" },
    slots: [],
  });
  fixture.navigate("alpha");
  fixture.w.pageLocations.switchProject("new");
  expect(fixture.w.pages.store.getState().location?.page).toEqual(workbenchPages.start);
  expect(fixture.w.modes.getActiveModeId()).toBe("beta");
});

test("a rejected boot browser commit does not fall back to an empty mode", () => {
  const browser = createMemoryWorkbenchPageLocationBrowser();
  browser.replace({ url: "/projects/project/tool" });
  let writes = 0;
  const core = createWorkbench({
    pageLocationBrowser: {
      ...browser,
      replace() {
        writes++;
        throw new Error("History rejected");
      },
    },
  });
  core.modes.registerMode({ id: "project", activate() {} });
  core.pages.registerPage({
    id: "tool",
    ref: { kind: "page", extensionId: "pstdio", id: "tool" },
    path: "tool",
    modeId: "project",
    main: { kind: "panels" },
    slots: [],
  });
  core.pageLocations.setProject("project");
  core.modes.setActiveMode("project");
  const before = core.pages.store.getState();
  expect(core.pageLocations.boot("project")).toMatchObject({
    ok: false,
    diagnostic: { message: "History rejected" },
  });
  expect(writes).toBe(1);
  expect(core.pages.store.getState()).toBe(before);
});
