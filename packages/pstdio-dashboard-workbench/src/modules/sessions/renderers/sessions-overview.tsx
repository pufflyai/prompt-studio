import { Badge, Stack } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "pstdio-workbench/react";
import { EmptyState, SurfaceListRow, SurfacePanel } from "@/services/components/surface";
import { sessionResource } from "@/services/workbench/resources/resource-kinds";
import { useSessions } from "../hooks/use-sessions";

const statusColor = (status: string) => {
  if (status === "in_progress" || status === "queued") return "blue";
  if (status === "completed") return "green";
  if (status === "failed" || status === "cancelled" || status === "disconnected") return "red";
  if (status === "awaiting_input") return "orange";
  return "gray";
};

export const SessionsOverview = (props: { input: WorkbenchWidgetRenderInput; projectId: string }) => {
  const { input, projectId } = props;
  const sessions = useSessions(projectId).filter((session) => !session.archived);

  return (
    <SurfacePanel title="Sessions" subtitle={`${sessions.length} active`}>
      {sessions.length === 0 ? (
        <EmptyState title="No sessions yet" description="Agent sessions for this project will appear here." />
      ) : (
        <Stack gap="xs" maxW="720px">
          {sessions.map((session) => (
            <SurfaceListRow
              key={session.id}
              icon="MessagesSquare"
              title={session.title}
              description={session.agent ?? "No agent"}
              trailing={
                <Badge size="sm" colorPalette={statusColor(session.status)}>
                  {session.status.replace(/_/g, " ")}
                </Badge>
              }
              onClick={() => void input.workbench.resources.openResource(sessionResource(session.id, session.title))}
            />
          ))}
        </Stack>
      )}
    </SurfacePanel>
  );
};
