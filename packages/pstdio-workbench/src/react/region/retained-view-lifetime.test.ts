import { expect, test } from "bun:test";
import { retainRecentViewPlacements } from "./retained-view-lifetime";

const tab = { widgetId: "session", contributionId: "session", viewId: "chat" };
const registered = new Set(["chat"]);
const initial = () => ({ placements: [tab], expires: new Map<string, number>() });

test("closed views preserve reading position and drafts for thirty minutes before unmounting", () => {
  const closed = retainRecentViewPlacements(initial(), [], registered, new Set(), 0);
  expect(closed.placements).toEqual([tab]);
  expect(closed.expires.get("session")).toBe(30 * 60_000);
  expect(retainRecentViewPlacements(closed, [], registered, new Set(), 30 * 60_000 - 1)).toBe(closed);
  expect(retainRecentViewPlacements(closed, [], registered, new Set(), 30 * 60_000).placements).toEqual([]);
});

test("inactive open tabs never expire and reopening a recent view restores its existing instance", () => {
  const cached = initial();
  expect(retainRecentViewPlacements(cached, [], registered, new Set(["session"]), 60 * 60_000)).toBe(cached);
  const closed = retainRecentViewPlacements(cached, [], registered, new Set(), 0);
  const reopened = retainRecentViewPlacements(closed, [{ ...tab }], registered, new Set(["session"]), 10 * 60_000);
  expect(reopened.placements[0]).toBe(tab);
  expect(reopened.expires.size).toBe(0);
  const closedAgain = retainRecentViewPlacements(reopened, [], registered, new Set(), 20 * 60_000);
  expect(closedAgain.expires.get("session")).toBe(50 * 60_000);
});

test("returning to a cached view preserves mount order before the open placement snapshot catches up", () => {
  const second = { ...tab, widgetId: "second" };
  const previous = { placements: [tab, second], expires: new Map([[tab.widgetId, 30 * 60_000]]) };
  const returned = retainRecentViewPlacements(previous, [{ ...tab }], registered, new Set(["second"]), 100);
  expect(returned.placements).toBe(previous.placements);
  expect(returned.expires.has(tab.widgetId)).toBe(false);
});

test("removing a view contribution releases it immediately while registered chrome retains its owner", () => {
  expect(retainRecentViewPlacements(initial(), [], new Set(), new Set(), 0).placements).toEqual([]);
  expect(retainRecentViewPlacements(initial(), [], registered, undefined, 60 * 60_000).placements).toEqual([tab]);
});
