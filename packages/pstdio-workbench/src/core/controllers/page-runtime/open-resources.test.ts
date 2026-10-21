import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

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
