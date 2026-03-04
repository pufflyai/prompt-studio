import { Box, Text } from "ink";
import Markdown from "ink-markdown";

import { StatusBadge } from "../components/status-badge";

type TicketListItem = {
  id: string;
  shorthand: string;
  title: string | null;
  status_id: string | null;
  status_name: string | null;
  priority: string | null;
  complexity: string | null;
  tag_names: string[];
  draft: boolean;
  archived: boolean;
};

type TicketStatus = {
  id: string;
  name: string;
  color: string;
  sort_order: number;
};

interface TicketContentProps {
  ticket: TicketListItem;
  statuses: TicketStatus[];
  width: number;
  viewportHeight: number;
}

export function TicketContent({ ticket, statuses, width, viewportHeight }: TicketContentProps) {
  const status = statuses.find((s) => s.id === ticket.status_id);
  const separator = "─".repeat(width);

  return (
    <Box flexDirection="column" height={viewportHeight} width={width}>
      <Box>
        <Text bold color="cyan">
          {ticket.shorthand}
        </Text>
        <Text dimColor> │ </Text>
        <Text bold>{ticket.title ?? "Untitled"}</Text>
        <Text dimColor> │ </Text>
        {status ? <StatusBadge name={status.name} color={status.color} /> : <Text dimColor>no status</Text>}
        {ticket.tag_names.length > 0 && (
          <Text>
            <Text dimColor> │ </Text>
            <Text color="yellow">{ticket.tag_names.join(", ")}</Text>
          </Text>
        )}
      </Box>

      {(ticket.priority || ticket.complexity) && (
        <Box>
          {ticket.priority && (
            <Text>
              <Text dimColor>Priority: </Text>
              <Text>{ticket.priority}</Text>
            </Text>
          )}
          {ticket.priority && ticket.complexity && <Text> </Text>}
          {ticket.complexity && (
            <Text>
              <Text dimColor>Complexity: </Text>
              <Text>{ticket.complexity}</Text>
            </Text>
          )}
        </Box>
      )}

      <Text dimColor>{separator}</Text>

      <Box flexDirection="column" overflow="hidden" flexGrow={1}>
        <Markdown>{`# ${ticket.title ?? "Untitled"}`}</Markdown>
      </Box>

      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>Esc:back e:status i:implement x:archive</Text>
      </Box>
    </Box>
  );
}
