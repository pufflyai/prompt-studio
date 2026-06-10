import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import { ParamEditor, type ParamEditorProps } from "@pstdio/ui";
import { useTicketHostProps, useTicketTranslation } from "../hooks/host-context";
import { useCommandMutation, useCommandQuery } from "../hooks/use-command";
import { SingleTagSelector, type TagSelectorTag } from "./single-tag-selector";
import { TicketLink } from "./ticket-link";
import { createTicketView } from "./view-shell";

const GET_TICKET = "pstdio-planner.get-ticket";
const READ_STATUSES = "pstdio-planner.ticketStatus.read";
const READ_TAGS = "pstdio-planner.ticketTag.read";
const SET_TAGS = "pstdio-planner.set-ticket-tags";

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
  const t = useTicketTranslation();
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
        <Text color="fg.muted">{t("ticketDetail.noTicketSelected", "No ticket selected.")}</Text>
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

  const statusName =
    statuses.find((status) => status.id === ticket.statusId)?.name ?? t("createTicketModal.noStatus", "No status");
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
    { id: "id", name: t("displayMenu.orderingOptions.shorthand", "ID"), type: "property", value: ticket.shorthand },
    {
      id: "updated",
      name: t("displayMenu.propertyOptions.updatedAt", "Updated"),
      type: "date",
      defaultValue: new Date(ticket.updatedAt).toLocaleString(),
    },
    { id: "status", name: t("displayMenu.propertyOptions.status", "Status"), type: "property", value: statusName },
    ...(ticket.archived
      ? [
          {
            id: "archived",
            name: t("ticketDetail.archived", "Archived"),
            type: "property" as const,
            value: t("ticketDetail.yes", "Yes"),
          },
        ]
      : []),
    ...(ticket.blockedReason
      ? [
          {
            id: "blocked-reason",
            name: t("ticketDetail.blockedReason", "Blocked reason"),
            type: "property" as const,
            value: ticket.blockedReason,
          },
        ]
      : []),
    {
      id: "depends-on",
      name: t("ticketDetail.dependsOn", "Depends on"),
      type: "property",
      value: ticket.dependsOn ? <TicketLink ticketId={ticket.dependsOn} /> : t("ticketDetail.none", "None"),
    },
    {
      id: "parent",
      name: t("ticketDetail.parent", "Parent"),
      type: "property",
      value: ticket.parentId ? <TicketLink ticketId={ticket.parentId} /> : t("ticketDetail.none", "None"),
    },
    ...tagRows,
  ];

  return (
    <Box p="sm">
      <ParamEditor params={params} readOnly />
    </Box>
  );
};

export default createTicketView(() => <TicketProperties />);
