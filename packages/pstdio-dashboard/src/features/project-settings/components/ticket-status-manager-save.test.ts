import { describe, expect, it, mock } from "bun:test";
import type { TicketStatusOption } from "@/features/ticket-list/types";
import { type DraftStatus, hasStatusChanges, saveStatuses, toDraftStatuses } from "./ticket-status-manager-save";

const buildStatus = (overrides: Partial<TicketStatusOption> = {}): TicketStatusOption => ({
  id: "s1",
  name: "backlog",
  color: "gray",
  sortOrder: 0,
  isDefault: true,
  canDragOut: true,
  canDragIn: true,
  canCreate: false,
  columnActions: [],
  actions: ["drag_in", "drag_out"],
  ...overrides,
});

describe("toDraftStatuses", () => {
  it("converts statuses to draft format sorted by sortOrder", () => {
    const statuses = [buildStatus({ id: "s2", sortOrder: 1 }), buildStatus({ id: "s1", sortOrder: 0 })];
    const drafts = toDraftStatuses(statuses);
    expect(drafts[0].id).toBe("s1");
    expect(drafts[1].id).toBe("s2");
  });
});

describe("hasStatusChanges", () => {
  it("returns false when nothing changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftStatuses(statuses);
    expect(hasStatusChanges(statuses, drafts, new Set(), null)).toBe(false);
  });

  it("returns true when a name changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftStatuses(statuses);
    drafts[0].name = "ready";
    expect(hasStatusChanges(statuses, drafts, new Set(), null)).toBe(true);
  });

  it("returns true when a status is deleted", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftStatuses(statuses);
    expect(hasStatusChanges(statuses, drafts, new Set(["s1"]), null)).toBe(true);
  });

  it("returns true when default changed", () => {
    const statuses = [buildStatus()];
    const drafts = toDraftStatuses(statuses);
    expect(hasStatusChanges(statuses, drafts, new Set(), "s2")).toBe(true);
  });

  it("returns true for new draft statuses", () => {
    const statuses = [buildStatus()];
    const drafts: DraftStatus[] = [
      ...toDraftStatuses(statuses),
      { id: "new-1", name: "wip", color: "blue", sortOrder: 1, isDefault: false, actions: [], isNew: true },
    ];
    expect(hasStatusChanges(statuses, drafts, new Set(), null)).toBe(true);
  });
});

describe("saveStatuses", () => {
  it("calls deleteStatus for deleted ids", async () => {
    const deleteStatus = mock(() => Promise.resolve());
    const statuses = [buildStatus()];

    await saveStatuses({
      original: statuses,
      drafts: [],
      deletedIds: new Set(["s1"]),
      newDefaultId: null,
      createStatus: mock(() => Promise.resolve()),
      updateStatus: mock(() => Promise.resolve()),
      setDefaultStatus: mock(() => Promise.resolve()),
      deleteStatus,
    });

    expect(deleteStatus).toHaveBeenCalledWith("s1");
  });

  it("calls createStatus for new drafts", async () => {
    const createStatus = mock(() => Promise.resolve());
    const drafts: DraftStatus[] = [
      { id: "new-1", name: "wip", color: "blue", sortOrder: 0, isDefault: false, actions: [], isNew: true },
    ];

    await saveStatuses({
      original: [],
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus,
      updateStatus: mock(() => Promise.resolve()),
      setDefaultStatus: mock(() => Promise.resolve()),
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(createStatus).toHaveBeenCalledWith({ name: "wip", color: "blue" });
  });

  it("calls updateStatus for changed fields only", async () => {
    const updateStatus = mock(() => Promise.resolve());
    const statuses = [buildStatus()];
    const drafts = toDraftStatuses(statuses);
    drafts[0].name = "ready";
    drafts[0].color = "teal";

    await saveStatuses({
      original: statuses,
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus: mock(() => Promise.resolve()),
      updateStatus,
      setDefaultStatus: mock(() => Promise.resolve()),
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(updateStatus).toHaveBeenCalledWith({ statusId: "s1", name: "ready", color: "teal" });
  });

  it("calls setDefaultStatus when newDefaultId is set", async () => {
    const setDefaultStatus = mock(() => Promise.resolve());

    await saveStatuses({
      original: [buildStatus()],
      drafts: toDraftStatuses([buildStatus()]),
      deletedIds: new Set(),
      newDefaultId: "s2",
      createStatus: mock(() => Promise.resolve()),
      updateStatus: mock(() => Promise.resolve()),
      setDefaultStatus,
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(setDefaultStatus).toHaveBeenCalledWith("s2");
  });

  it("detects action changes", async () => {
    const updateStatus = mock(() => Promise.resolve());
    const statuses = [buildStatus({ actions: ["drag_in", "drag_out"] })];
    const drafts = toDraftStatuses(statuses);
    drafts[0].actions = ["drag_in", "drag_out", "create_ticket"];

    await saveStatuses({
      original: statuses,
      drafts,
      deletedIds: new Set(),
      newDefaultId: null,
      createStatus: mock(() => Promise.resolve()),
      updateStatus,
      setDefaultStatus: mock(() => Promise.resolve()),
      deleteStatus: mock(() => Promise.resolve()),
    });

    expect(updateStatus).toHaveBeenCalledWith({
      statusId: "s1",
      can_create: true,
      can_drag_in: true,
      can_drag_out: true,
      column_actions: [],
    });
  });
});
