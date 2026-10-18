import { Icon } from "@chakra-ui/react";
import { type SessionCompletionStatus, SessionIndicator } from "@pstdio/ui";
import { Moon } from "lucide-react";

export type AutoBuildIndicatorStatus = SessionCompletionStatus | "sleeping" | undefined;

interface AutoBuildStatusInput {
  enabled: boolean;
  completed?: boolean;
  failed: boolean;
  stuck?: boolean;
  supervisorStatus?: string;
  running: number;
}

export function resolveAutoBuildIndicatorStatus(input: AutoBuildStatusInput) {
  const { enabled, completed, failed, stuck, supervisorStatus, running } = input;
  if (failed) return "failed";
  if (!enabled) return undefined;
  if (completed) return "completed";
  if (stuck || supervisorStatus === "awaiting_input") return "awaiting_input";
  if (running > 0 || supervisorStatus === "in_progress") return "in_progress";
  if (supervisorStatus === "queued") return "queued";
  return "sleeping";
}

interface AutoBuildIndicatorProps {
  status: AutoBuildIndicatorStatus;
  label: string;
}

export function AutoBuildIndicator(props: AutoBuildIndicatorProps) {
  const { status, label } = props;
  if (status === "sleeping") return <Icon as={Moon} boxSize="icon-xs" color="fg.info" aria-label={label} />;
  return <SessionIndicator status={status} boxSize="icon-xs" ariaLabel={label} />;
}
