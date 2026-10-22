import { type KanbanRendererAttributeDescriptor, l10n } from "@pstdio/sdk/extensions";
import { attentionPanelTarget } from "../../attention-panel";
import { REVIEW_REQUEST_ITEMS_ATTRIBUTE, reviewRequestBadgeItems } from "../../data/review-request-summary";
import type { Deadline, Plan } from "../contracts";

export function timelineTicketAttributes(deadlines: readonly Deadline[]) {
  const attributes: KanbanRendererAttributeDescriptor[] = [
    {
      id: "milestone",
      label: l10n("ticketProperties.milestone", "Milestone"),
      type: {
        kind: "enum",
        options: deadlines.map((deadline) => ({
          value: deadline.id,
          label: deadline.name || deadline.date,
          icon: "calendar",
        })),
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
      display: { kind: "badge-list", itemsAttributeId: REVIEW_REQUEST_ITEMS_ATTRIBUTE },
    },
  ];
  return attributes;
}

export function timelineTicketProperties(plan: Plan) {
  const attributes = timelineTicketAttributes(plan.sections.flatMap(({ deadline }) => (deadline ? [deadline] : [])));
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
              [REVIEW_REQUEST_ITEMS_ATTRIBUTE]: reviewRequestBadgeItems(
                { requests: row.requests, errors: row.requestErrors },
                attentionPanelTarget(row.target.resource!, "timeline"),
              ),
            },
          ] as const,
      );
    }),
  );
  return { attributes, values };
}
