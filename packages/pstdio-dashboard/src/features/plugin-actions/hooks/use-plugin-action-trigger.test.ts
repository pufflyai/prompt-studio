import { describe, expect, it } from "bun:test";
import { addPendingActionKey, removePendingActionKey } from "./use-plugin-action-trigger";

describe("pending action keys", () => {
  it("tracks multiple actions at the same time", () => {
    const pendingActionKeys = addPendingActionKey(["run-attempt"], "run-review");

    expect(pendingActionKeys).toEqual(["run-attempt", "run-review"]);
  });

  it("does not duplicate the same action key", () => {
    const pendingActionKeys = addPendingActionKey(["run-attempt"], "run-attempt");

    expect(pendingActionKeys).toEqual(["run-attempt"]);
  });

  it("removes only the completed action key", () => {
    const pendingActionKeys = removePendingActionKey(["run-attempt", "run-review"], "run-attempt");

    expect(pendingActionKeys).toEqual(["run-review"]);
  });
});
