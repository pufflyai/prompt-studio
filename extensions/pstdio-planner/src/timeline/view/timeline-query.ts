// Adapt saved Planner properties and timeline milestones to the Planner's shared filter toolbar.
import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import type { Plan } from "../contracts";
import { ticketFilterValues } from "../model/ticket-query";

export function timelineQueryData(plan: Plan | undefined) {
  const tickets = plan?.sections.flatMap(({ rows }) => rows) ?? [];
  const tags = plan?.tags ?? [];
  const attributes: AttributeDescriptor[] = [
    {
      id: "status",
      label: "Status",
      filterable: true,
      type: {
        kind: "enum",
        options: [...new Set(tickets.map(({ status }) => status))].map((value) => ({
          value,
          label: value,
          icon: plan?.statuses.find((status) => status.name === value)?.icon ?? "circle",
        })),
      },
    },
    {
      id: "milestone",
      label: "Milestone",
      filterable: true,
      type: {
        kind: "enum",
        options:
          plan?.sections.map(({ deadline }) => ({
            value: deadline?.id ?? "none",
            label: deadline?.name ?? deadline?.date ?? "Unscheduled",
            icon: "calendar",
          })) ?? [],
      },
    },
    ...tags
      .filter((tag) => tag.options.length > 0)
      .map(
        (tag): AttributeDescriptor => ({
          id: tag.id,
          label: tag.name,
          filterable: true,
          type: {
            kind: "enum-multi",
            options: tag.options.map(({ id, name, icon, color }) => ({
              value: id,
              label: name,
              icon: icon ?? "circle",
              color,
            })),
          },
        }),
      ),
  ];
  const rows: KanbanRendererRow[] = tickets.map((row) => ({
    id: row.id,
    title: `${row.shorthand} ${row.title}`,
    attributes: { ...ticketFilterValues(row, tags), status: row.status, milestone: row.deadlineId ?? "none" },
  }));
  return { rows, attributes, storageKey: `pstdio.pstdio-planner.timeline:${plan?.trackProperty?.id ?? "loading"}` };
}
