import { expect, test } from "bun:test";
import { createWindowingFixture } from "../../../examples/windowing/fixture";
import { windowingPages } from "../../../examples/windowing/resources";

test("the page catalog can focus a static tool moved into a mode panel", async () => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true });
  const w = fixture.workbench;
  w.pageLocations.navigate({ kind: "page", page: windowingPages.workspace, resource: fixture.resources.workspaces[0] });
  const source = w.layout
    .getLayout()
    .regions.main.widgets.find(
      (tab) => tab.placementIdentity?.kind === "page" && tab.placementIdentity.slotId === "files",
    )!;
  w.layout.activatePanel(source.widgetId);
  w.movePanel(source.widgetId, "side");
  const choice = w.composition.panelsFor("main").addable.find((panel) => panel.contribution.title === "Files");
  expect(choice).toBeDefined();
  await choice!.open!(fixture.resources.workspaces[0]);
  expect(w.layout.getLayout().regions.side.activeWidgetId).toBe(source.widgetId);
  await fixture.dispose();
});

test.each([
  "bottom",
  "main",
] as const)("a static page tool transferred through mode Side stays with its destination %s owner", async (destination) => {
  const fixture = createWindowingFixture("windowing", { pagePanels: true, changesPresence: "fixed" });
  const w = fixture.workbench;
  w.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[0],
  });
  const source = w.layout
    .getLayout()
    .regions.main.widgets.find(
      (tab) => tab.placementIdentity?.kind === "page" && tab.placementIdentity.slotId === "changes",
    )!;
  w.layout.activatePanel(source.widgetId);
  w.movePanel(source.widgetId, "side");
  w.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[1],
  });
  w.movePanel(source.widgetId, destination);
  w.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[0],
  });
  expect(
    w.layout
      .getLayout()
      .regions.main.widgets.some(
        (tab) => tab.placementIdentity?.kind === "page" && tab.placementIdentity.slotId === "changes",
      ),
  ).toBe(false);
  expect(
    Object.values(w.layout.getLayout().regions)
      .flatMap((region) => region.widgets)
      .map((tab) => tab.widgetId),
  ).not.toContain(source.widgetId);
  w.pageLocations.navigate({
    kind: "page",
    page: windowingPages.workspace,
    resource: fixture.resources.workspaces[1],
  });
  expect(w.layout.getLayout().regions[destination].widgets).toContainEqual(
    expect.objectContaining({ widgetId: source.widgetId, resource: fixture.resources.workspaces[0] }),
  );
  await fixture.dispose();
});
