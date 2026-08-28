import { describe, expect, it } from "bun:test";
import { isValidElement } from "react";

import { CollectionBadge } from "./collection-badge";
import {
  collectDisplayBadges,
  collectDisplayCustomSlots,
  getAttributeBadgeColorPalette,
  renderBadgeListDisplay,
} from "./kanban-renderer-helpers";
import type { AttributeDescriptor, KanbanRendererRow } from "./types";

const attributes: AttributeDescriptor[] = [
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "todo", label: "Todo", color: "gray" },
        { value: "done", label: "Done", color: "green" },
      ],
    },
    displayable: true,
  },
  {
    id: "owner",
    label: "Owner",
    type: { kind: "user" },
    displayable: true,
  },
  {
    id: "updated",
    label: "Updated",
    type: { kind: "date" },
    displayable: true,
  },
];

const badgeListAttributes: AttributeDescriptor[] = [
  {
    id: "workspace",
    label: "Workspace",
    type: { kind: "string" },
    displayable: true,
    display: { kind: "badge-list", itemsAttributeId: "workspaceItems" },
  },
];

describe("collectDisplayBadges", () => {
  it("emits one badge per displayProperty id that resolves to a value", () => {
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: { status: "todo", owner: "Alice", updated: "2026-03-10T00:00:00Z" },
    };

    const badges = collectDisplayBadges(row, attributes, ["status", "owner", "updated"]);

    expect(badges.map((badge) => badge.attributeId)).toEqual(["status", "owner", "updated"]);
  });

  it("ignores display properties that reference unknown attributes", () => {
    const row: KanbanRendererRow = { id: "1", title: "A", attributes: { status: "todo" } };
    const badges = collectDisplayBadges(row, attributes, ["status", "unknown"]);

    expect(badges).toHaveLength(1);
  });

  it("leaves custom rendered attributes out of the default badge list", () => {
    const renderedAttributes: AttributeDescriptor[] = [
      ...attributes,
      {
        id: "diffOverview",
        label: "Diff",
        type: { kind: "string" },
        displayable: true,
        render: (value) => `diff:${value}`,
      },
    ];
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: { status: "todo", diffOverview: "+8 -2" },
    };

    const badges = collectDisplayBadges(row, renderedAttributes, ["status", "diffOverview"]);

    expect(badges.map((badge) => badge.attributeId)).toEqual(["status"]);
  });

  it("leaves display renderer attributes out of the default badge list", () => {
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: {
        workspace: "workspace-1",
        workspaceItems: [{ id: "workspace-1", name: "Attempt 1", type: "worktree" }],
      },
    };

    expect(collectDisplayBadges(row, badgeListAttributes, ["workspace"])).toEqual([]);
  });
});

describe("getAttributeBadgeColorPalette", () => {
  it("keeps tag badge containers neutral when enum colors are declared", () => {
    expect(getAttributeBadgeColorPalette({ attributeId: "status", label: "Done", color: "green" })).toBe("gray");
  });

  it("falls back to neutral badges when no color is declared", () => {
    expect(getAttributeBadgeColorPalette({ attributeId: "status", label: "Done" })).toBe("gray");
  });
});

describe("collectDisplayCustomSlots", () => {
  it("emits rendered display properties as custom slots", () => {
    const renderedAttributes: AttributeDescriptor[] = [
      {
        id: "diffOverview",
        label: "Diff",
        type: { kind: "string" },
        displayable: true,
        render: (value, row) => `diff:${value}:${row.title}`,
      },
    ];
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: { diffOverview: "+8 -2" },
    };

    expect(collectDisplayCustomSlots(row, renderedAttributes, ["diffOverview"])).toEqual(["diff:+8 -2:A"]);
  });

  it("omits empty rendered output", () => {
    const renderedAttributes: AttributeDescriptor[] = [
      {
        id: "diffOverview",
        label: "Diff",
        type: { kind: "string" },
        displayable: true,
        render: () => null,
      },
    ];
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: {},
    };

    expect(collectDisplayCustomSlots(row, renderedAttributes, ["diffOverview"])).toEqual([]);
  });

  it("exposes every badge list resource", () => {
    const row: KanbanRendererRow = {
      id: "1",
      title: "A",
      attributes: {
        workspace: "workspace-2",
        workspaceItems: [
          {
            id: "workspace-1",
            label: "T-1_A1",
            icon: "GitBranch",
            resource: { type: "workspace", id: "workspace-1" },
          },
          {
            id: "workspace-2",
            label: "T-1_A2",
            icon: "GitCommit",
            resource: { type: "workspace", id: "workspace-2" },
          },
        ],
      },
    };

    const opened: string[] = [];
    const slot = renderBadgeListDisplay(badgeListAttributes[0]!, "workspace-2", row, (resource) =>
      opened.push(resource.id),
    );

    expect(Array.isArray(slot)).toBe(true);
    if (!Array.isArray(slot)) throw new Error("Expected a badge element for each item");
    expect(slot).toHaveLength(2);
    for (const badge of slot) expect(isValidElement(badge) && badge.type).toBe(CollectionBadge);
    expect(slot.map((badge) => badge.props.label)).toEqual(["T-1_A2", "T-1_A1"]);

    slot[0].props.onClick();
    slot[1].props.onClick();
    expect(opened).toEqual(["workspace-2", "workspace-1"]);
  });
});
