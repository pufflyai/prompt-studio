import { Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@pstdio/ui";
import type { AutoBuildButtonProps } from "./auto-build-button";
import { AutoBuildSessionRow } from "./auto-build-session-row";

interface AutoBuildSessionsProps
  extends Pick<AutoBuildButtonProps, "sessions" | "running" | "capacity" | "onOpenSession" | "t"> {}

export function AutoBuildSessions(props: AutoBuildSessionsProps) {
  const { sessions, running, capacity, onOpenSession, t } = props;
  return (
    <Stack gap="2xs">
      <Text textStyle="label/2XS/medium" color="fg.muted">
        {t("timeline.autoBuild.agents", "Agents")} ({running} {t("timeline.autoBuild.capacity", "of")} {capacity})
      </Text>
      {sessions.map((session) => (
        <AutoBuildSessionRow key={session.id} session={session} onOpen={onOpenSession} />
      ))}
      {sessions.length === 0 ? <EmptyState size="sm" title={t("timeline.autoBuild.noSessions", "No agents")} /> : null}
    </Stack>
  );
}
