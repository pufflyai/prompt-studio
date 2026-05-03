import { Badge } from "@chakra-ui/react";

export type TicketStatus = "todo" | "wip" | "review" | "done" | "blocked";

const PALETTE: Record<TicketStatus, { bg: string; fg: string; label: string }> = {
  todo: { bg: "bg.muted", fg: "fg.muted", label: "Todo" },
  wip: { bg: "yellow.subtle", fg: "yellow.fg", label: "WIP" },
  review: { bg: "blue.subtle", fg: "blue.fg", label: "Review" },
  done: { bg: "green.subtle", fg: "green.fg", label: "Done" },
  blocked: { bg: "red.subtle", fg: "red.fg", label: "Blocked" },
};

interface StatusBadgeProps {
  status: TicketStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const tone = PALETTE[status];
  return (
    <Badge bg={tone.bg} color={tone.fg} textTransform="uppercase" letterSpacing="0.04em" fontSize="2xs">
      {tone.label}
    </Badge>
  );
};
