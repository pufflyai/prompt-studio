import { Box, Stack, Text } from "@chakra-ui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTicketHostProps } from "../hooks/host-context";
import { useCommandQuery } from "../hooks/use-command";

const LIST_TICKET_WORKSPACES = "pstdio-planner.list-ticket-workspaces";
// Matches the full command id `pstdio-planner.create-ticket-workspace`; the leading
// dot avoids matching unrelated commands that merely end in the same word.
const CREATE_TICKET_WORKSPACE = ".create-ticket-workspace";

interface TicketWorkspace {
  id: string;
  shorthand: string;
  branch: string | null;
  name: string | null;
  initializing: boolean;
}

// Lists the workspaces linked to the ticket (ticket -> workspace). "Create workspace"
// runs from the ticket header (outside this webview), so we refetch when the host
// broadcasts a successful create for this ticket (same pattern as the editor's file
// sync).
export const TicketWorkspacesSection = ({ ticketId }: { ticketId: string }) => {
  const { lastCommand } = useTicketHostProps();
  const queryClient = useQueryClient();
  const workspacesQuery = useCommandQuery<{ workspaces: TicketWorkspace[] }>({
    queryKey: ["ticket-workspaces", ticketId],
    commandId: LIST_TICKET_WORKSPACES,
    params: { ticket: ticketId },
    enabled: Boolean(ticketId),
  });

  useEffect(() => {
    if (!lastCommand?.outcome?.ok) return;
    if (!lastCommand.commandId.endsWith(CREATE_TICKET_WORKSPACE)) return;
    const value = lastCommand.outcome.value as { ticketId?: string } | undefined;
    if (value?.ticketId !== ticketId) return;
    void queryClient.invalidateQueries({ queryKey: ["ticket-workspaces", ticketId] });
  }, [lastCommand, ticketId, queryClient]);

  const workspaces = workspacesQuery.data?.workspaces ?? [];
  if (workspaces.length === 0) return null;

  return (
    <Stack gap="2xs" pt="sm">
      <Text textStyle="label/XS/medium" color="fg.muted" textTransform="uppercase">
        Workspaces
      </Text>
      {workspaces.map((workspace) => (
        <Box key={workspace.id}>
          <Text textStyle="label/S/medium">{workspace.shorthand}</Text>
          <Text textStyle="paragraph/XS/regular" color="fg.muted">
            {workspace.initializing ? "Setting up…" : (workspace.branch ?? "—")}
          </Text>
        </Box>
      ))}
    </Stack>
  );
};
