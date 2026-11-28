import { expect, test } from "bun:test";
import type { ResourceRef, ViewFilterGroup } from "@pstdio/sdk/extensions";
import { projectKanbanColumnArchive, projectKanbanResourceChange } from "./project-kanban-resource-change";

const ticket: ResourceRef = { type: "ticket", extensionId: "pstdio.planner", projectId: "project", id: "ticket" };
const archive = { archived: true, attributeId: "archived", value: "archived" } as const;
const active: ViewFilterGroup = {
  conjunction: "and",
  rules: [{ attributeId: "archived", condition: "is-any-of", value: ["active"] }],
};
const otherRow = { id: "other", title: "Other", attributes: { status: "backlog", archived: "active" } };
const snapshot = {
  rows: [
    { id: ticket.id, title: "Ticket", resource: ticket, attributes: { status: "done", archived: "active" } },
    otherRow,
  ],
  attributes: [
    {
      id: "archived",
      label: "Archived",
      filterable: true,
      type: {
        kind: "enum" as const,
        options: [
          { value: "active", label: "Active" },
          { value: "archived", label: "Archived" },
        ],
      },
    },
  ],
  page: {
    revision: "r1",
    cursor: "next",
    total: 9,
    filteredTotal: 9,
    groups: [
      { field: "status", value: "done", count: 4 },
      { field: "status", value: "backlog", count: 5 },
    ],
  },
};

test("archive and delete remove one card from active results and preserve other cards", () => {
  for (const change of [archive, { removed: true } as const]) {
    const projected = projectKanbanResourceChange(snapshot, ticket, change, active);
    expect(projected.rows).toEqual([otherRow]);
    expect(projected.rows[0]).toBe(otherRow);
    expect(projected.page).toMatchObject({ total: 8, groups: [{ count: 3 }, { count: 5 }] });
    expect(projectKanbanResourceChange(snapshot, { ...ticket, projectId: "other" }, change, active)).toBe(snapshot);
  }
  expect(snapshot.rows[0].attributes.archived).toBe("active");
});

test("archive changes an all-tickets view in place and clears a whole active column count", () => {
  const all = projectKanbanResourceChange(snapshot, ticket, archive, { conjunction: "and", rules: [] });
  expect(all.rows[0].attributes.archived).toBe("archived");
  expect(all.rows[1]).toBe(otherRow);
  expect(all.page).toBe(snapshot.page);

  const cleared = projectKanbanColumnArchive(snapshot, "done", active);
  expect(cleared.rows).toEqual([otherRow]);
  expect(cleared.page).toMatchObject({ total: 5, groups: [{ count: 0 }, { count: 5 }] });
  const unloaded = { ...snapshot, rows: [otherRow] };
  const clearedUnloaded = projectKanbanColumnArchive(unloaded, "done", active);
  expect(clearedUnloaded.rows).toEqual([otherRow]);
  expect(clearedUnloaded.page).toEqual(cleared.page);
});
