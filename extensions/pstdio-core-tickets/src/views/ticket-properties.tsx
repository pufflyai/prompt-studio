import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import { ParamEditor, type ParamEditorProps } from "@pstdio/ui";
import { useTicketHostProps } from "../hooks/host-context";
import { useCommandMutation, useCommandQuery } from "../hooks/use-command";
import { SingleTagSelector, type TagSelectorTag } from "./single-tag-selector";
import { createTicketView } from "./view-shell";

const GET_TICKET = "pstdio-core-tickets.get-ticket";
const READ_STATUSES = "pstdio-core-tickets.ticketStatus.read";
const READ_TAGS = "pstdio-core-tickets.ticketTag.read";
const SET_TAGS = "pstdio-core-tickets.set-ticket-tags";

interface LoadedTicket {
  id: string;
  shorthand: string;
  statusId: string | null;
  tagIds?: string[];
  parentId?: string | null;
  dependsOn?: string | null;
  blockedReason?: string | null;
  archived?: boolean;
  updatedAt: string;
}

interface StatusDef {
  id: string;
  name: string;
}

type ParamRows = NonNullable<ParamEditorProps["params"]>;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const TicketProperties = () => {
  const { resource } = useTicketHostProps();
  const ticketId = resource?.id;

  const ticketQuery = useCommandQuery<LoadedTicket | null>({
    queryKey: ["ticket", ticketId],
    commandId: GET_TICKET,
    params: { id: ticketId },
    enabled: Boolean(ticketId),
  });
  const statusesQuery = useCommandQuery<{ statuses?: StatusDef[] }>({
    queryKey: ["statuses"],
    commandId: READ_STATUSES,
  });
  const tagsQuery = useCommandQuery<{ tags?: TagSelectorTag[] }>({ queryKey: ["tags"], commandId: READ_TAGS });

  const setTags = useCommandMutation({ commandId: SET_TAGS, invalidate: [["ticket", ticketId]] });

  const ticket = ticketQuery.data ?? null;
  const statuses = statusesQuery.data?.statuses ?? [];
  const tags = tagsQuery.data?.tags ?? [];

  const updateTags = (nextIds: string[]) => {
    if (!ticket) return;
    setTags.mutate({ rowId: ticket.id, tagIds: nextIds });
  };

  if (!ticketId) {
    return (
      <Center h="full" minH="0" p="lg">
        <Text color="fg.muted">No ticket selected.</Text>
      </Center>
    );
  }

  if (!ticket) {
    return (
      <Center h="full" minH="0">
        <Spinner size="sm" />
      </Center>
    );
  }

  const statusName = statuses.find((status) => status.id === ticket.statusId)?.name ?? "No status";
  const selectedTagIds = ticket.tagIds ?? [];

  const tagRows: ParamRows = tags.map((tag) => ({
    id: `tag-${tag.id}`,
    name: capitalize(tag.name),
    type: "property",
    value: (
      <SingleTagSelector
        tag={tag}
        selectedOptionIds={selectedTagIds}
        isDisabled={setTags.isPending}
        onChange={updateTags}
      />
    ),
  }));

  const params: ParamRows = [
    { id: "id", name: "ID", type: "property", value: ticket.shorthand },
    { id: "updated", name: "Updated", type: "property", value: new Date(ticket.updatedAt).toLocaleString() },
    { id: "status", name: "Status", type: "property", value: statusName },
    ...(ticket.archived ? [{ id: "archived", name: "Archived", type: "property" as const, value: "Yes" }] : []),
    ...(ticket.blockedReason
      ? [{ id: "blocked-reason", name: "Blocked reason", type: "property" as const, value: ticket.blockedReason }]
      : []),
    { id: "depends-on", name: "Depends on", type: "property", value: ticket.dependsOn || "None" },
    { id: "parent", name: "Parent", type: "property", value: ticket.parentId || "None" },
    ...tagRows,
  ];

  return (
    <Box p="sm">
      <ParamEditor params={params} />
    </Box>
  );
};

export default createTicketView(() => <TicketProperties />);
