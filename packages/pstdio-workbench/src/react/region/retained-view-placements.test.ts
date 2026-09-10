import { expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { retainViewPlacements } from "./retained-view-placements";

const playlist = { widgetId: "playlist", contributionId: "music", viewId: "playlist-view" } as WorkbenchWidgetPlacement;

test("visited registered views survive navigation without mounting unvisited views", () => {
  const registered = new Set(["playlist-view", "unvisited-view"]);
  const visited = retainViewPlacements([], [playlist], registered);
  expect(retainViewPlacements(visited, [], registered)).toEqual([playlist]);
});

test("removing a view contribution releases its retained placements", () => {
  expect(retainViewPlacements([playlist], [], new Set())).toEqual([]);
});

test("returning to a placement updates its inputs without changing its identity", () => {
  const updated = { ...playlist, title: "Updated playlist" };
  expect(retainViewPlacements([playlist], [updated], new Set(["playlist-view"]))).toEqual([updated]);
});

test("panels without registered views retain their existing unmount behavior", () => {
  const panel = { widgetId: "panel", contributionId: "panel" } as WorkbenchWidgetPlacement;
  expect(retainViewPlacements([panel], [], new Set())).toEqual([]);
});
