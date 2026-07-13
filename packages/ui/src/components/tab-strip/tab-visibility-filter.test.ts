import { describe, expect, test } from "bun:test";
import { buildTabVisibilityMenuActions, filterVisibleTabs } from "./tab-visibility-filter";

const getKey = (placement: { contributionId: string }) => `main:${placement.contributionId}`;

const placements = [
  { contributionId: "alpha", title: "Alpha", closable: false },
  { contributionId: "beta", title: "Beta", closable: false, hiddenByDefault: true },
  { contributionId: "gamma", title: "Gamma", closable: true },
];

describe("filterVisibleTabs", () => {
  test("passes closeable tabs through unconditionally", () => {
    const result = filterVisibleTabs(placements, { "main:gamma": "hidden" }, getKey);
    expect(result.find((placement) => placement.contributionId === "gamma")).toBeDefined();
  });

  test("hides non-closeable tabs that resolve to 'hidden'", () => {
    const result = filterVisibleTabs(placements, {}, getKey);
    expect(result.map((placement) => placement.contributionId)).toEqual(["alpha", "gamma"]);
  });

  test("user override of 'shown' un-hides a hiddenByDefault tab", () => {
    const result = filterVisibleTabs(placements, { "main:beta": "shown" }, getKey);
    expect(result.map((placement) => placement.contributionId)).toEqual(["alpha", "beta", "gamma"]);
  });

  test("keeps pinned hiddenByDefault tabs hidden even when an override exists", () => {
    const result = filterVisibleTabs(
      [
        ...placements,
        { contributionId: "launcher", title: "Launcher", closable: false, hiddenByDefault: true, pinned: true },
      ],
      { "main:launcher": "shown" },
      getKey,
    );
    expect(result.map((placement) => placement.contributionId)).toEqual(["alpha", "gamma"]);
  });

  test("returns input reference when nothing changes", () => {
    const allVisible = [
      { contributionId: "x", title: "X", closable: false },
      { contributionId: "y", title: "Y", closable: true },
    ];
    expect(filterVisibleTabs(allVisible, {}, getKey)).toBe(allVisible);
  });
});

describe("buildTabVisibilityMenuActions", () => {
  const noopActions = { onToggleTab: () => {}, onResetAll: () => {} };

  const icons = { visibleIcon: "eye", hiddenIcon: "eye-off" } as const;

  test("lists only non-closeable tabs and appends reset", () => {
    const actions = buildTabVisibilityMenuActions(placements, {}, noopActions, getKey, icons);
    expect(actions.map((action) => action.key)).toEqual(["tab:main:alpha", "tab:main:beta", "__reset-tabs"]);
  });

  test("shows the eye on visible tabs and eye-off on hidden tabs", () => {
    const actions = buildTabVisibilityMenuActions(placements, {}, noopActions, getKey, icons);
    const find = (key: string) => actions.find((action) => action.key === key);
    expect(find("tab:main:alpha")?.endContent).toBe("eye");
    expect(find("tab:main:beta")?.endContent).toBe("eye-off");
  });

  test("omits pinned infrastructure tabs from the visibility menu", () => {
    const actions = buildTabVisibilityMenuActions(
      [
        ...placements,
        { contributionId: "launcher", title: "Launcher", closable: false, hiddenByDefault: true, pinned: true },
      ],
      {},
      noopActions,
      getKey,
      icons,
    );

    expect(actions.map((action) => action.key)).toEqual(["tab:main:alpha", "tab:main:beta", "__reset-tabs"]);
  });

  test("returns no entries when there are no non-closeable tabs", () => {
    const onlyCloseable = [{ contributionId: "z", title: "Z", closable: true }];
    expect(buildTabVisibilityMenuActions(onlyCloseable, {}, noopActions, getKey, icons)).toEqual([]);
  });
});
