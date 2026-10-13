import { Icon, Text } from "@chakra-ui/react";
import { ListRow, SessionIndicator, sessionCompletionStatuses } from "@pstdio/ui";
import { Moon } from "lucide-react";

export interface AutoBuildSession {
  id: string;
  title: string;
  status?: string;
}

interface AutoBuildSessionRowProps {
  session: AutoBuildSession;
  label: string;
  statusLabel?: string;
  onOpen: (session: AutoBuildSession) => void;
}

export function AutoBuildSessionRow(props: AutoBuildSessionRowProps) {
  const { session, label, statusLabel, onOpen } = props;
  const status = sessionCompletionStatuses.find((status) => status === session.status);
  return (
    <ListRow
      id={session.id}
      role="button"
      variant="compact"
      label={session.title}
      description={label}
      icon={
        statusLabel ? (
          <Icon as={Moon} boxSize="icon-xs" color="fg.muted" />
        ) : (
          <SessionIndicator status={status} boxSize="icon-xs" color="fg.muted" />
        )
      }
      endContent={
        <Text textStyle="label/XS" color="fg.muted">
          {statusLabel ?? (status === "in_progress" ? "Working" : status?.replaceAll("_", " ")) ?? "Unknown"}
        </Text>
      }
      onActivate={() => onOpen(session)}
    />
  );
}
