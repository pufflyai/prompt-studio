import { describe, expect, test } from "bun:test";
import type { ViewFilterGroup, ViewFilterRule } from "@pstdio/sdk/extensions";
import type { AttributeDescriptor } from "@pstdio/ui/kanban-renderer";
import type { Plan, PlanRow, PlanTag } from "../contracts";
import { visibleTracks } from "./visible-tracks";

const track: PlanTag = {
  id: "track",
  name: "Track",
  type: "single_select",
  sortOrder: 0,
  options: ["api", "ui", "docs"].map((id, sortOrder) => ({
    id,
    name: id.toUpperCase(),
    color: "gray",
    sortOrder,
    icon: null,
    description: null,
  })),
};

const fields: AttributeDescriptor[] = [
  {
    id: "track",
    label: "Track",
    type: { kind: "enum", options: track.options.map(({ id, name }) => ({ value: id, label: name })) },
    filterable: true,
  },
  { id: "priority", label: "Priority", type: { kind: "enum", options: [{ value: "high", label: "High" }] } },
];

const plan = (trackIds: (string | null)[]) =>
  ({
    trackProperty: track,
    sections: [{ deadline: null, rows: trackIds.map((trackId, index) => ({ id: `T-${index}`, trackId }) as PlanRow) }],
  }) as Plan;

const rule = (condition: ViewFilterRule["condition"], value?: ViewFilterRule["value"], attributeId = "track") => ({
  attributeId,
  condition,
  value,
});
const all = (...rules: ViewFilterRule[]): ViewFilterGroup => ({ conjunction: "and", rules });
const any = (...rules: ViewFilterRule[]): ViewFilterGroup => ({ conjunction: "or", rules });
const ids = (input: Parameters<typeof visibleTracks>) => visibleTracks(...input).list.map(({ id }) => id);

describe("visibleTracks", () => {
  test("keeps the normal track list without a Track rule", () => {
    expect(ids([plan(["api", null]), all(rule("is-any-of", ["high"], "priority")), fields])).toEqual([
      "api",
      "ui",
      "docs",
      "unassigned",
    ]);
    expect(ids([plan(["api"]), all(), fields])).toEqual(["api", "ui", "docs"]);
  });

  test("shows only the selected tracks in property order", () => {
    expect(ids([plan(["api", "ui", "docs"]), all(rule("is-any-of", ["docs", "api"])), fields])).toEqual([
      "api",
      "docs",
    ]);
  });

  test("shows Unassigned only when the Track rule accepts an empty value", () => {
    expect(ids([plan([null]), all(rule("is-any-of", ["ui"])), fields])).toEqual(["ui"]);
    expect(ids([plan(["api"]), all(rule("is-empty")), fields])).toEqual(["unassigned"]);
    expect(ids([plan(["api"]), all(rule("is-none-of", ["api"])), fields])).toEqual(["ui", "docs", "unassigned"]);
    expect(ids([plan(["api"]), any(rule("is-any-of", ["ui"]), rule("is-empty")), fields])).toEqual([
      "ui",
      "unassigned",
    ]);
  });

  test("keeps a track that another alternative of the filter can still match", () => {
    const either = any(rule("is-any-of", ["ui"]), rule("is-any-of", ["high"], "priority"));
    const both = all(rule("is-any-of", ["ui"]), rule("is-any-of", ["high"], "priority"));

    expect(ids([plan(["api"]), either, fields])).toEqual(["api", "ui", "docs", "unassigned"]);
    expect(ids([plan(["api"]), both, fields])).toEqual(["ui"]);
  });

  test("ignores rules still being edited and empty groups, as the ticket filter does", () => {
    const editingTrack = any(rule("is-any-of", ["ui"]), rule("is-any-of", []));
    const editingOther = any(rule("is-any-of", ["ui"]), rule("is-any-of", [], "priority"));
    const emptyGroup: ViewFilterGroup = {
      conjunction: "and",
      rules: [],
      groups: [
        { conjunction: "or", rules: [rule("is-any-of", ["ui"])] },
        { conjunction: "or", rules: [] },
      ],
    };

    expect(ids([plan(["api"]), editingTrack, fields])).toEqual(["ui"]);
    expect(ids([plan(["api"]), editingOther, fields])).toEqual(["ui"]);
    expect(ids([plan(["api"]), emptyGroup, fields])).toEqual(["ui"]);
    expect(ids([plan(["api", null]), all(rule("is-any-of", [])), fields])).toEqual(["api", "ui", "docs", "unassigned"]);
  });

  test("places rows by their position among the visible tracks", () => {
    const tracks = visibleTracks(plan(["api", "docs"]), all(rule("is-any-of", ["api", "docs"])), fields);

    expect(tracks.indexOf({ trackId: "docs" } as PlanRow)).toBe(1);
  });
});
