import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { GitBranch } from "lucide-react";

import { Header } from "../../header";
import { ListRow } from "../../list-row/list-row";
import { Properties } from "../../properties";
import { MarkdownEditor } from "../../rich-text/markdown-editor/markdown-editor";
import type { WorkspaceTicket } from "../../tickets/types";
import { mockTicketDescription, mockWorkspaces } from "../mock-data";
import { ResizablePanel } from "../resizable-panel";

interface TicketDetailsPageProps {
  ticket: WorkspaceTicket;
  onOpenWorkspace: (workspaceShorthand: string) => void;
}

const formatDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const TicketDetailsPage = (props: TicketDetailsPageProps) => {
  const { ticket, onOpenWorkspace } = props;
  const workspaces = mockWorkspaces.filter((workspace) => workspace.ticketId === ticket.id);

  return (
    <HStack flex="1" minH="0" align="stretch" gap="0">
      <Box flex="1" minW="0" overflow="auto">
        <MarkdownEditor
          key={ticket.id}
          defaultState={mockTicketDescription}
          isEditable
          placeholder="Write a description…"
        />
      </Box>

      <ResizablePanel
        defaultWidth={300}
        minWidth={240}
        maxWidth={480}
        handleSide="left"
        ariaLabel="Resize details sidebar"
        borderLeftWidth="1px"
        borderColor="border.muted"
        bg="bg"
      >
        <Header variant="narrow" borderBottomWidth="1px" borderColor="border.muted" bg="bg">
          <Text textStyle="label/S/medium">Properties</Text>
        </Header>
        <Stack flex="1" minH="0" overflowY="auto" gap="0">
          <Box p="sm">
            <Properties
              items={[
                {
                  label: "Status",
                  value: (
                    <Badge colorPalette={ticket.statusColor ?? "gray"} variant="subtle">
                      {ticket.status ?? "—"}
                    </Badge>
                  ),
                },
                { label: "Assignee", value: ticket.assignee ?? "Unassigned" },
                { label: "Updated", value: formatDate(ticket.updatedAt ?? null) },
                {
                  label: "Tags",
                  value: (
                    <HStack gap="2xs" flexWrap="wrap">
                      {(ticket.tags ?? []).map((tag) => (
                        <Badge key={`${tag.name}:${tag.value}`} variant="subtle">
                          {tag.value}
                        </Badge>
                      ))}
                      {(ticket.tags ?? []).length === 0 ? (
                        <Text textStyle="label/XS" color="fg.muted">
                          None
                        </Text>
                      ) : null}
                    </HStack>
                  ),
                },
              ]}
            />
          </Box>

          <Stack gap="2xs" p="sm" borderTopWidth="1px" borderColor="border.muted">
            <HStack justify="space-between">
              <Text textStyle="label/S/medium" color="fg.muted">
                Workspaces
              </Text>
              <Button size="xs" variant="ghost">
                New
              </Button>
            </HStack>
            {workspaces.length === 0 ? (
              <Text textStyle="label/XS" color="fg.muted">
                No workspaces yet.
              </Text>
            ) : (
              workspaces.map((workspace) => (
                <ListRow
                  key={workspace.id}
                  variant="compact"
                  id={workspace.id}
                  label={`Workspace ${workspace.shorthand}`}
                  description={workspace.branch}
                  icon={<GitBranch size={14} />}
                  onActivate={() => onOpenWorkspace(workspace.shorthand)}
                />
              ))
            )}
          </Stack>
        </Stack>
      </ResizablePanel>
    </HStack>
  );
};
