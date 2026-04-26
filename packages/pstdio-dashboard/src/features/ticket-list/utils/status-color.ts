import type { TicketStatusColor } from "../types";

const DEFAULT_STATUS_COLOR: TicketStatusColor = "gray";

export const resolveTicketStatusColorPalette = (statusColor?: TicketStatusColor) => statusColor ?? DEFAULT_STATUS_COLOR;

export const resolveTicketStatusForeground = (statusColor?: TicketStatusColor) =>
  `${resolveTicketStatusColorPalette(statusColor)}.fg`;
