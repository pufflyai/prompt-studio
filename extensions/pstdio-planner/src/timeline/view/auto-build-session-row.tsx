import { ListRow, sessionCompletionStatuses } from "@pstdio/ui";
import { AutoBuildIndicator } from "./auto-build-indicator";

export interface AutoBuildSession {
  id: string;
  title: string;
  status?: string;
}

interface AutoBuildSessionRowProps {
  session: AutoBuildSession;
  sleeping?: boolean;
  onOpen: (session: AutoBuildSession) => void;
}

export function AutoBuildSessionRow(props: AutoBuildSessionRowProps) {
  const { session, sleeping, onOpen } = props;
  const status = sessionCompletionStatuses.find((status) => status === session.status);
  return (
    <ListRow
      id={session.id}
      role="button"
      variant="compact"
      label={session.title}
      icon={
        <AutoBuildIndicator
          status={sleeping ? "sleeping" : status}
          label={sleeping ? "Sleeping" : (status?.replaceAll("_", " ") ?? "Unknown")}
        />
      }
      onActivate={() => onOpen(session)}
    />
  );
}
