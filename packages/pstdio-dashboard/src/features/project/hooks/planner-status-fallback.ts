import type { TicketStatusOption } from "@/features/ticket-list/types";

export const PLANNER_FALLBACK_STATUS_OPTION = {
  id: "planner-unassigned",
  name: "Unassigned",
  color: "gray",
  sortOrder: 0,
  isDefault: true,
  canDragOut: true,
  canDragIn: true,
  canCreate: true,
  columnActions: [],
  actions: ["create_ticket", "drag_in", "drag_out"],
} satisfies TicketStatusOption;

export const withPlannerFallbackStatus = (options: TicketStatusOption[]) =>
  options.length > 0 ? options : [PLANNER_FALLBACK_STATUS_OPTION];
