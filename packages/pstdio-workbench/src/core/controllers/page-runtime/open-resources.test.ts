import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

test("resource removal publishes layout membership after clearing inactive saved tabs", () => {
  const s = modePanelFixture();
  const resource = { type: "document", id: "inactive", projectId: "project" };
  s.w.shellPlacements.openPlacement({ placementId: "shared-side", resource, open: "pin" });
  const instanceId = s.w.layout.getActivePanel("side")!.instanceId;
  s.navigate("beta");
  const selections: boolean[] = [];
  const stop = s.w.layout.store.subscribe(() =>
    selections.push(s.w.host.getOpenPlacements().some((p) => p.widgetId === instanceId)),
  );
  try {
    s.w.resources.removed(resource);
    expect(selections.length).toBeGreaterThan(0);
    expect(selections.every((open) => !open)).toBe(true);
  } finally {
    stop();
  }
});

test("restoring another mode retains persisted open tabs without visiting them", () => {
  const first = modePanelFixture();
  first.open("persisted-session", "side", "pin");
  first.navigate("beta");
  const reloaded = modePanelFixture(first.saved, true, [], "beta");
  expect(reloaded.w.getOpenResources().map((resource) => resource.id)).toContain("persisted-session");
});

test("removing a resource clears an unvisited persisted tab after reload", () => {
  const first = modePanelFixture();
  first.open("removed-session", "side", "pin");
  first.navigate("beta");
  const reloaded = modePanelFixture(first.saved, true, [], "beta");
  reloaded.w.resources.removed({ type: "document", id: "removed-session" });
  expect(reloaded.w.getOpenResources().map((resource) => resource.id)).not.toContain("removed-session");
});

test("open resources include inactive tabs and tabs in another page or mode", () => {
  const s = modePanelFixture();
  s.open("first", "side", "pin");
  s.open("second", "side", "pin");
  s.navigate("document", "main");
  s.w.pages.pinPlacement(s.w.layout.getLayout().regions.main.widgets[0].placementIdentity!);
  s.navigate("beta");
  const ids = s.w.getOpenResources?.().map((resource) => resource.id) ?? [];
  expect(ids).toContain("first");
  expect(ids).toContain("second");
  expect(ids).toContain("main");
});

test("closing a tab removes its resource even after another page is restored", () => {
  const s = modePanelFixture();
  s.open("session", "side", "pin");
  const tab = s.w.layout.getActivePanel("side")!;
  s.navigate("beta");
  s.navigate("alpha");
  s.w.closePlacement(tab.placementIdentity!);
  expect(s.w.getOpenResources?.().map((resource) => resource.id) ?? []).not.toContain("session");
  s.navigate("beta");
  expect(s.w.getOpenResources?.().map((resource) => resource.id) ?? []).not.toContain("session");
});
