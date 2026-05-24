import { describe, expect, mock, test } from "bun:test";
import type { AttemptStatusOption } from "../hooks/use-attempt-statuses";
import {
  type DraftAttemptStatus,
  hasAttemptStatusChanges,
  saveAttemptStatuses,
  toDraftAttemptStatuses,
} from "./attempt-status-manager-save";

const original: AttemptStatusOption = {
  id: "status-1",
  name: "wip",
  color: "blue",
  icon: null,
  sortOrder: 1,
  isDefault: true,
};

describe("attempt-status-manager-save", () => {
  test("toDraftAttemptStatuses carries icon through", () => {
    const drafts = toDraftAttemptStatuses([{ ...original, icon: "eye" }]);
    expect(drafts[0]?.icon).toBe("eye");
  });

  test("hasAttemptStatusChanges detects icon edits", () => {
    const drafts: DraftAttemptStatus[] = [{ ...original, icon: "eye" }];
    expect(hasAttemptStatusChanges([original], drafts, new Set(), null)).toBe(true);
  });

  test("saveAttemptStatuses sends icon on update for existing rows", async () => {
    const updateStatus = mock(() => Promise.resolve());
    const createStatus = mock(() => Promise.resolve());
    const deleteStatus = mock(() => Promise.resolve());

    const drafts: DraftAttemptStatus[] = [{ ...original, icon: "shield" }];

    await saveAttemptStatuses({
      original: [original],
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus,
      updateStatus,
      deleteStatus,
    });

    expect(updateStatus).toHaveBeenCalledWith({ id: "status-1", icon: "shield" });
    expect(createStatus).not.toHaveBeenCalled();
  });

  test("saveAttemptStatuses forwards icon when creating a new status", async () => {
    const createStatus = mock(() => Promise.resolve());
    const updateStatus = mock(() => Promise.resolve());
    const deleteStatus = mock(() => Promise.resolve());

    const drafts: DraftAttemptStatus[] = [
      {
        id: "new-1",
        name: "blocked",
        color: "red",
        icon: "shield-alert",
        sortOrder: 2,
        isDefault: false,
        isNew: true,
      },
    ];

    await saveAttemptStatuses({
      original: [],
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus,
      updateStatus,
      deleteStatus,
    });

    expect(createStatus).toHaveBeenCalledWith({ name: "blocked", color: "red", icon: "shield-alert" });
  });
});
