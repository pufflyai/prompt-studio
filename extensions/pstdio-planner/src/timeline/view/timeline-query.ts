import { EMPTY_VIEW_FILTER, withTitleField } from "@pstdio/ui/collection-view";
import {
  type AttributeDescriptor,
  DEFAULT_KANBAN_RENDERER_SETTINGS,
  type KanbanRendererRow,
} from "@pstdio/ui/kanban-renderer";
import { buildTicketAttributes } from "../../data/mappers";
import { localizeTicketFormValue } from "../../ticket-create-form";
import type { PlanClient } from "./use-plan";

export const timelineInitialState = {
  settings: DEFAULT_KANBAN_RENDERER_SETTINGS,
  filter: EMPTY_VIEW_FILTER,
  sorts: [],
};

export function timelineQueryData(
  plan: Awaited<ReturnType<PlanClient["commands"]["timeline.plan.read"]>>,
  t: (key: string, fallback?: string) => string,
) {
  const attributes = buildTicketAttributes(plan.statuses, plan.tags).flatMap<AttributeDescriptor>((attribute) => {
    const type = attribute.type;
    if (type.kind === "status") return [];
    if (type.kind === "enum" || type.kind === "enum-multi") {
      return [
        {
          ...attribute,
          label: localizeTicketFormValue(attribute.label, t),
          type: {
            ...type,
            options: Array.isArray(type.options)
              ? type.options.map((option) => ({ ...option, label: localizeTicketFormValue(option.label, t) }))
              : [],
          },
        },
      ];
    }
    return [{ ...attribute, label: localizeTicketFormValue(attribute.label, t), type }];
  });
  const rows: KanbanRendererRow[] = plan.ticketRows;
  return {
    rows,
    attributes: withTitleField(attributes),
    storageKey: `pstdio.pstdio-planner.timeline-views:${plan.projectId}`,
  };
}
