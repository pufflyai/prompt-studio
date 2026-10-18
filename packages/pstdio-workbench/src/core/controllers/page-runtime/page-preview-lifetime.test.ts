import { expect, test } from "bun:test";
import { modePanelFixture } from "./mode-panel-state.fixture";

test.each(["main", "side", "secondary"] as const)("page navigation closes every unpinned %s tab", (region) => {
  const s = modePanelFixture();
  s.open("kept", region, "pin");
  s.open("temporary", region);
  s.w.layout.setRegionVisible(region, true);
  s.navigate("alpha-list");
  expect(s.ids(region)).toEqual(region === "main" ? [] : ["kept"]);
  s.navigate("alpha");
  expect(s.ids(region)).toEqual(["kept"]);
});

test.each(["side", "secondary"] as const)("page navigation closes an empty %s panel", (region) => {
  const s = modePanelFixture();
  s.open("temporary", region);
  s.w.shell.setRegionOpen(region, true);
  s.navigate("alpha-list");
  expect(s.ids(region)).toEqual([]);
  expect(s.w.shell.getRegionState(region).open).toBe(false);
});

test("mode switching keeps previews until a page changes inside their own mode", () => {
  const s = modePanelFixture();
  s.open("alpha-preview", "side");
  s.navigate("beta");
  s.open("beta-preview", "secondary");
  s.navigate("alpha");
  expect(s.ids("side")).toEqual(["alpha-preview"]);
  s.navigate("alpha-list");
  expect(s.ids("side")).toEqual([]);
  s.navigate("beta");
  expect(s.ids("secondary")).toEqual(["beta-preview"]);
});

test("changing resources closes the old preview without closing the incoming resource", () => {
  const s = modePanelFixture();
  s.navigate("document", "old");
  s.open("temporary", "side");
  s.navigate("document", "next");
  expect(s.ids("main")).toEqual(["next"]);
  expect(s.ids("side")).toEqual([]);
  s.navigate("document", "old");
  expect(s.ids("main")).toEqual(["old"]);
  expect(s.ids("side")).toEqual([]);
});

test("refreshing metadata and reselecting the current page preserve its previews", () => {
  const s = modePanelFixture();
  s.navigate("document", "source");
  s.open("temporary", "side");
  s.w.pages.refreshResource({ type: "document", id: "source", label: "Updated" });
  s.navigate("document", "source");
  expect(s.ids("side")).toEqual(["temporary"]);
});
