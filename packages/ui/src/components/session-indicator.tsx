import { Icon } from "@chakra-ui/react";
import { CircleAlert, CircleCheck, CircleDashed, CirclePause, CircleStop } from "lucide-react";
import type { ComponentProps } from "react";

export type SessionCompletionStatus =
  | "in_progress"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled"
  | "disconnected";

export const resolveSessionIndicatorIcon = (status: SessionCompletionStatus | undefined) => {
  if (status === "completed") return CircleCheck;
  if (status === "failed") return CircleAlert;
  if (status === "cancelled") return CircleStop;
  if (status === "disconnected") return CirclePause;
  return CircleDashed;
};

export const resolveSessionIndicatorColor = (status: SessionCompletionStatus | undefined) => {
  if (status === "completed") return "fg.success";
  if (status === "failed") return "fg.error";
  if (status === "cancelled") return "fg.warning";
  if (status === "disconnected") return "fg.warning";
  return "fg.muted";
};

interface SessionIndicatorProps {
  status?: SessionCompletionStatus;
  boxSize?: ComponentProps<typeof Icon>["boxSize"];
  ariaLabel?: string;
  cursor?: ComponentProps<typeof Icon>["cursor"];
  onClick?: ComponentProps<typeof Icon>["onClick"];
}

export const SessionIndicator = (props: SessionIndicatorProps) => {
  const { status, boxSize = "14px", ariaLabel = "Session status", cursor, onClick } = props;

  return (
    <Icon
      as={resolveSessionIndicatorIcon(status)}
      boxSize={boxSize}
      color={resolveSessionIndicatorColor(status)}
      aria-label={ariaLabel}
      cursor={cursor}
      onClick={onClick}
    />
  );
};
