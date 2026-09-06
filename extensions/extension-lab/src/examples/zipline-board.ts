import {
  defineView,
  type KanbanRendererAttributeDescriptor,
  type KanbanRendererSettings,
  l10n,
} from "@pstdio/sdk/extensions";
import { ziplineIssues } from "../apps/zipline-data";
import { readExampleState } from "../example-state";
import { examplesChanged, updateState } from "../state-commands";

const boardAttributes: KanbanRendererAttributeDescriptor[] = [
  { id: "id", label: "ID", type: { kind: "string" }, displayable: true },
  {
    id: "status",
    label: "Status",
    type: {
      kind: "enum",
      options: [
        { value: "Backlog", label: "Backlog", color: "gray", icon: "circle" },
        { value: "In progress", label: "In progress", color: "purple", icon: "circle-dot-dashed" },
        { value: "Done", label: "Done", color: "green", icon: "circle-check" },
      ],
    },
    filterable: true,
    groupable: true,
    sortable: true,
    editable: true,
  },
  {
    id: "priority",
    label: "Priority",
    type: {
      kind: "enum",
      options: [
        { value: "High", label: "High", color: "red" },
        { value: "Medium", label: "Medium", color: "yellow" },
        { value: "Low", label: "Low", color: "gray" },
      ],
    },
    filterable: true,
    sortable: true,
    displayable: true,
  },
  {
    id: "team",
    label: "Team",
    type: {
      kind: "enum",
      options: ["Product", "Platform", "Design", "Growth"].map((team) => ({ value: team, label: team })),
    },
    filterable: true,
    groupable: true,
    displayable: true,
  },
  {
    id: "assignee",
    label: "Assignee",
    type: { kind: "user" },
    filterable: true,
    groupable: true,
    displayable: true,
  },
];

const boardSettings = {
  viewMode: "board",
  columnGrouping: "status",
  rowGrouping: "none",
  ordering: { attributeId: "manual", direction: "asc" },
  displayProperties: ["id", "priority", "team", "assignee"],
} satisfies Partial<KanbanRendererSettings>;

export const board = defineView({
  id: "zipline-board",
  title: l10n("views.zipline-board", "My issues"),
  body: {
    kind: "kanban",
    attributes: boardAttributes,
    defaultSettings: boardSettings,
    refreshEvents: [examplesChanged],
    async query(ctx) {
      const state = await readExampleState(ctx.storage, "zipline");
      return {
        rows: ziplineIssues.map((issue) => ({
          id: issue.id,
          title: issue.title,
          resource: { type: "zipline.issue", id: issue.id, label: issue.title },
          attributes: {
            id: issue.id,
            status: state.statuses[issue.id],
            priority: issue.priority,
            team: issue.team,
            assignee: issue.assignee,
          },
        })),
        boardColumnConfigs: {
          Backlog: { color: "gray", canDragIn: true, canDragOut: true },
          "In progress": { color: "purple", canDragIn: true, canDragOut: true },
          Done: { color: "green", canDragIn: true, canDragOut: true },
        },
      };
    },
    async onRowActivate(_ctx, { row }) {
      return { kind: "page", page: { kind: "page", id: "zipline-resource" }, resource: row.resource };
    },
    async onAttributeChange(ctx, { rowId, attributeId, value }) {
      if (attributeId !== "status" || !["Backlog", "In progress", "Done"].includes(String(value)))
        throw new Error("Unknown issue status");
      return ctx.commands.execute(updateState.ref, {
        params: { name: "zipline", changes: [{ path: ["statuses", rowId], value }] },
      });
    },
  },
});
