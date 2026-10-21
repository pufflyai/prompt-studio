import { expect, test } from "bun:test";
import type { WorkbenchWidgetPlacement } from "../../core";
import { retainViewPlacements } from "./retained-view-placements";

const playlist = {
  widgetId: "playlist",
  contributionId: "music",
  viewId: "playlist-view",
  placementIdentity: { kind: "mode", modeId: "music", placementId: "playlist" },
} as WorkbenchWidgetPlacement;

test("registered chrome views keep their state across mode changes", () => {
  const chrome = { widgetId: "music-bar", contributionId: "music", viewId: "music-bar" } as WorkbenchWidgetPlacement;
  expect(retainViewPlacements([chrome], [], new Set(["music-bar"]))).toEqual([chrome]);
});

test("closing a tab releases its retained view even when its view contribution is still registered", () => {
  expect(retainViewPlacements([playlist], [], new Set(["playlist-view"]), new Set())).toEqual([]);
});

test("visited registered views survive navigation without mounting unvisited views", () => {
  const registered = new Set(["playlist-view", "unvisited-view"]);
  const open = new Set(["playlist"]);
  const visited = retainViewPlacements([], [playlist], registered, open);
  expect(retainViewPlacements(visited, [], registered, open)).toEqual([playlist]);
});

test("removing a view contribution releases its retained placements", () => {
  expect(retainViewPlacements([playlist], [], new Set(), new Set(["playlist"]))).toEqual([]);
});

test("returning to a placement updates its inputs without changing its identity", () => {
  const updated = { ...playlist, title: "Updated playlist" };
  expect(retainViewPlacements([playlist], [updated], new Set(["playlist-view"]), new Set(["playlist"]))).toEqual([
    updated,
  ]);
});

test("panels without registered views retain their existing unmount behavior", () => {
  const panel = { widgetId: "panel", contributionId: "panel" } as WorkbenchWidgetPlacement;
  expect(retainViewPlacements([panel], [], new Set(), new Set())).toEqual([]);
});

test("unchanged current placements stay stable while their views are not registered", () => {
  const current = { ...playlist };
  const previous = [current];
  expect(retainViewPlacements(previous, [{ ...current }], new Set(), new Set(["playlist"]))).toBe(previous);
});
