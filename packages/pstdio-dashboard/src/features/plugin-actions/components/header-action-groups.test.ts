import { describe, expect, it } from "bun:test";
import type { ActionDescriptor } from "../api";
import { buildHeaderActionGroups, type HeaderActionItem, mergeHeaderOverflowActions } from "./header-action-groups";

const makePluginAction = (overrides: Partial<ActionDescriptor> = {}): ActionDescriptor => ({
  key: "plugin/run-attempt",
  label: "Run attempt",
  targetType: "ticket",
  placement: "primary",
  ...overrides,
});

const makeDefaultAction = (overrides: Partial<HeaderActionItem> = {}): HeaderActionItem => ({
  key: "archive",
  label: "Archive",
  kind: "default",
  onClick() {},
  ...overrides,
});

describe("buildHeaderActionGroups", () => {
  it("splits plugin actions by placement and appends default actions to overflow", () => {
    const groups = buildHeaderActionGroups({
      pluginActions: [
        makePluginAction(),
        makePluginAction({
          key: "plugin/run-review",
          label: "Run review",
          targetType: "workspace",
          placement: "secondary",
        }),
        makePluginAction({
          key: "plugin/refine-ticket",
          label: "Refine ticket",
          placement: "overflow",
        }),
      ],
      defaultOverflowActions: [makeDefaultAction(), makeDefaultAction({ key: "delete", label: "Delete" })],
      onPluginAction: () => {},
    });

    expect(groups.primary.map((action) => action.label)).toEqual(["Run attempt"]);
    expect(groups.secondary.map((action) => action.label)).toEqual(["Run review"]);
    expect(groups.overflow.map((action) => action.label)).toEqual(["Refine ticket", "Archive", "Delete"]);
    expect(groups.overflow[0]?.kind).toBe("plugin");
    expect(groups.overflow[1]?.kind).toBe("default");
  });

  it("returns only default overflow actions when no plugin actions are available", () => {
    const groups = buildHeaderActionGroups({
      pluginActions: undefined,
      defaultOverflowActions: [makeDefaultAction({ label: "Archive session" })],
      onPluginAction: () => {},
    });

    expect(groups.primary).toEqual([]);
    expect(groups.secondary).toEqual([]);
    expect(groups.overflow.map((action) => action.label)).toEqual(["Archive session"]);
  });

  it("keeps plugin action icons on header action items", () => {
    const groups = buildHeaderActionGroups({
      pluginActions: [makePluginAction({ icon: "play" })],
      defaultOverflowActions: [],
      onPluginAction: () => {},
    });

    expect(groups.primary[0]?.icon).toBe("play");
  });
});

describe("mergeHeaderOverflowActions", () => {
  it("places custom actions before default actions", () => {
    const actions = mergeHeaderOverflowActions({
      customActions: [makeDefaultAction({ key: "custom", label: "Custom" })],
      defaultActions: [makeDefaultAction({ key: "default", label: "Default" })],
    });

    expect(actions.map((action) => action.key)).toEqual(["custom", "default"]);
  });
});
