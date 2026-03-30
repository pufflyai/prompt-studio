import { describe, expect, it, mock } from "bun:test";
import type { AttemptStatusOption } from "../hooks/use-attempt-statuses";
import {
  type DraftAttemptStatus,
  hasAttemptStatusChanges,
  saveAttemptStatuses,
  toDraftAttemptStatuses,
} from "./attempt-status-manager-save";

const buildStatus = (overrides: Partial<AttemptStatusOption> = {}): AttemptStatusOption => ({
  id: "s1",
  name: "running",
  color: "blue",
  sortOrder: 0,
  isDefault: true,
  ...overrides,
});

describe("toDraftAttemptStatuses", () => {
  it("converts and sorts by sortOrder", () => {
    const statuses = [buildStatus({ id: "s2", sortOrder: 1 }), buildStatus({ id: "s1", sortOrder: 0 })];
    const drafts = toDraftAttemptStatuses(statuses);
    expect(drafts[0].id).toBe("s1");
    expect(drafts[1].id).toBe("s2");
  });
});

describe("hasAttemptStatusChanges", () => {
  it("returns false when nothing changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftAttemptStatuses(statuses);
    expect(hasAttemptStatusChanges(statuses, drafts, new Set(), null)).toBe(false);
  });

  it("returns true when a name changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftAttemptStatuses(statuses);
    drafts[0].name = "blocked";
    expect(hasAttemptStatusChanges(statuses, drafts, new Set(), null)).toBe(true);
  });

  it("returns true when a status is deleted", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftAttemptStatuses(statuses);
    expect(hasAttemptStatusChanges(statuses, drafts, new Set(["s1"]), null)).toBe(true);
  });

  it("returns true when default changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftAttemptStatuses(statuses);
    expect(hasAttemptStatusChanges(statuses, drafts, new Set(), "s2")).toBe(true);
  });

  it("returns true for new drafts", () => {
    const statuses = [buildStatus()];
    const drafts: DraftAttemptStatus[] = [
      ...toDraftAttemptStatuses(statuses),
      { id: "new-1", name: "wip", color: "green", sortOrder: 1, isDefault: false, isNew: true },
    ];
    expect(hasAttemptStatusChanges(statuses, drafts, new Set(), null)).toBe(true);
  });
});

describe("saveAttemptStatuses", () => {
  it("calls deleteStatus for deleted ids", async () => {
    const deleteStatus = mock(() => Promise.resolve());

    await saveAttemptStatuses({
      original: [buildStatus()],
      drafts: [],
      deletedIds: new Set(["s1"]),
      newDefaultId: null,
      createStatus: mock(() => Promise.resolve()),
      updateStatus: mock(() => Promise.resolve()),
      deleteStatus,
    });

    expect(deleteStatus).toHaveBeenCalledWith("s1");
  });

  it("calls createStatus for new drafts", async () => {
    const createStatus = mock(() => Promise.resolve());
    const drafts: DraftAttemptStatus[] = [
      { id: "new-1", name: "wip", color: "green", sortOrder: 0, isDefault: false, isNew: true },
    ];

    await saveAttemptStatuses({
      original: [],
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus,
      updateStatus: mock(() => Promise.resolve()),
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(createStatus).toHaveBeenCalledWith({ name: "wip", color: "green" });
  });

  it("calls updateStatus for changed fields only", async () => {
    const updateStatus = mock(() => Promise.resolve());
    const statuses = [buildStatus()];
    const drafts = toDraftAttemptStatuses(statuses);
    drafts[0].name = "blocked";
    drafts[0].color = "red";

    await saveAttemptStatuses({
      original: statuses,
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus: mock(() => Promise.resolve()),
      updateStatus,
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(updateStatus).toHaveBeenCalledWith({ id: "s1", name: "blocked", color: "red" });
  });

  it("calls updateStatus with is_default when newDefaultId is set", async () => {
    const updateStatus = mock(() => Promise.resolve());

    await saveAttemptStatuses({
      original: [buildStatus()],
      drafts: toDraftAttemptStatuses([buildStatus()]),
      deletedIds: new Set(),
      newDefaultId: "s2",
      createStatus: mock(() => Promise.resolve()),
      updateStatus,
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(updateStatus).toHaveBeenCalledWith({ id: "s2", is_default: true });
  });
});
