import { withTitleField } from "@pstdio/ui/collection-view";
import type { AttributeDescriptor, KanbanRendererRow } from "@pstdio/ui/kanban-renderer";
import { localizeTicketFormValue } from "../../ticket-create-form";
import type { readPlanCommand } from "../commands/read-plan";

export function timelineQueryData(
  plan: Awaited<ReturnType<typeof readPlanCommand.run>>,
  t: (key: string, fallback?: string) => string,
) {
  const attributes = plan.ticketAttributes.flatMap<AttributeDescriptor>((attribute) => {
    const type = attribute.type;
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
