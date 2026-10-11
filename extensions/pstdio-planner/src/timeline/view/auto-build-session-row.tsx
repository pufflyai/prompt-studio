import { Text } from "@chakra-ui/react";
import { ListRow, SessionIndicator, sessionCompletionStatuses } from "@pstdio/ui";

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
      icon={<SessionIndicator status={status} boxSize="icon-xs" />}
      endContent={
        <Text textStyle="label/XS" color="fg.muted">
          {statusLabel ?? status?.replaceAll("_", " ") ?? "Unknown"}
        </Text>
      }
      onActivate={() => onOpen(session)}
    />
  );
}
