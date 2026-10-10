import { type KanbanRendererAttributeDescriptor, l10n } from "@pstdio/sdk/extensions";
import type { Plan } from "../contracts";

export function timelineTicketProperties(plan: Plan) {
  const attributes: KanbanRendererAttributeDescriptor[] = [
    {
      id: "milestone",
      label: l10n("ticketProperties.milestone", "Milestone"),
      type: {
        kind: "enum",
        options: plan.sections.flatMap(({ deadline }) =>
          deadline ? [{ value: deadline.id, label: deadline.name || deadline.date, icon: "calendar" }] : [],
        ),
      },
      filterable: true,
      displayable: true,
      groupable: true,
    },
    {
      id: "milestoneDate",
      label: l10n("ticketProperties.milestoneDate", "Milestone date"),
      type: { kind: "date" },
      filterable: true,
      displayable: true,
      sortable: true,
    },
    {
      id: "milestoneState",
      label: l10n("ticketProperties.milestoneProgress", "Milestone progress"),
      type: {
        kind: "enum",
        options: [
          { value: "unscheduled", label: l10n("ticketProperties.unscheduled", "Unscheduled") },
          { value: "open", label: l10n("ticketProperties.milestoneOpen", "Open") },
          { value: "complete", label: l10n("ticketProperties.milestoneComplete", "Complete") },
          {
            value: "completed-past",
            label: l10n("ticketProperties.milestoneCompletedPast", "Completed past milestone"),
          },
        ],
      },
      filterable: true,
      displayable: true,
    },
    {
      id: "needsAttention",
      label: l10n("ticketProperties.needsAttention", "Needs attention"),
      type: {
        kind: "enum",
        options: [
          { value: "yes", label: l10n("ticketProperties.yes", "Yes") },
          { value: "no", label: l10n("ticketProperties.no", "No") },
        ],
      },
      filterable: true,
      displayable: true,
    },
  ];
  const values = new Map(
    plan.sections.flatMap((section) => {
      const { deadline, counts } = section;
      let milestoneState = "unscheduled";
      if (deadline) {
        milestoneState = "open";
        if (counts.total > 0 && counts.done === counts.total)
          milestoneState = deadline.daysLeft < 0 ? "completed-past" : "complete";
      }
      return section.rows.map(
        (row) =>
          [
            row.id,
            {
              milestone: deadline?.id ?? "",
              milestoneDate: deadline?.date ?? null,
              milestoneState,
              needsAttention: !row.done && (row.flags.length > 0 || row.blocks.length > 0) ? "yes" : "no",
            },
          ] as const,
      );
    }),
  );
  return { attributes, values };
}
