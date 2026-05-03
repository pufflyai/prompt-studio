import { describe, expect, it } from "bun:test";
import type { HeaderActionItem } from "./header-actions";
import { getHeaderActionState, groupHeaderActions, isOverflowMenuDisabled } from "./header-actions";

const makeAction = (overrides: Partial<HeaderActionItem> = {}): HeaderActionItem => ({
  key: "run-attempt",
  label: "Run attempt",
  kind: "default",
  onClick() {},
  ...overrides,
});

describe("groupHeaderActions", () => {
  it("groups built-in actions by placement and defaults to overflow", () => {
    const groups = groupHeaderActions([
      makeAction({ key: "create", placement: "primary" }),
      makeAction({ key: "review", placement: "secondary" }),
      makeAction({ key: "archive" }),
    ]);

    expect(groups.primary.map((action) => action.key)).toEqual(["create"]);
    expect(groups.secondary.map((action) => action.key)).toEqual(["review"]);
    expect(groups.overflow.map((action) => action.key)).toEqual(["archive"]);
  });
});

describe("getHeaderActionState", () => {
  it("keeps sibling actions enabled while another action is running", () => {
    const state = getHeaderActionState(makeAction({ key: "run-review" }), ["run-attempt"]);

    expect(state).toEqual({ isDisabled: false, isPending: false });
  });

  it("disables and marks the matching action as pending", () => {
    const state = getHeaderActionState(makeAction(), ["run-attempt"]);

    expect(state).toEqual({ isDisabled: true, isPending: true });
  });

  it("preserves explicit disabled state", () => {
    const state = getHeaderActionState(makeAction({ isDisabled: true }), []);

    expect(state).toEqual({ isDisabled: true, isPending: false });
  });
});

describe("isOverflowMenuDisabled", () => {
  it("stays enabled while at least one overflow action can still run", () => {
    const disabled = isOverflowMenuDisabled(
      [makeAction(), makeAction({ key: "run-review", label: "Run review" })],
      ["run-attempt"],
    );

    expect(disabled).toBe(false);
  });

  it("disables the overflow trigger when every action is unavailable", () => {
    const disabled = isOverflowMenuDisabled([makeAction()], ["run-attempt"]);

    expect(disabled).toBe(true);
  });
});
