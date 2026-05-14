import { Box, Button, Flex } from "@chakra-ui/react";
import { ItemSection, ParamEditor } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { Project } from "@/features/project/types";
import type { Ticket } from "@/features/ticket-list/types";
import { resolveParentTicketReference } from "../utils/resolve-parent-ticket-reference";
import { getTimeFormat } from "../utils/time-format";
import { SingleTagSelector } from "./single-tag-selector";
import { TicketLink } from "./ticket-link";

interface TicketPropertiesProps {
  ticket: Ticket;
  project?: Project | null;
  tickets?: Ticket[];
  onSelectTicket?: (ticketId: string) => void;
  onTagIdsChange?: (tagIds: string[]) => void;
  isUpdatingTags?: boolean;
}

const parseShorthands = (value: string | null | undefined) => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const TicketProperties = (props: TicketPropertiesProps) => {
  const { ticket, project = null, tickets = [], onSelectTicket, onTagIdsChange, isUpdatingTags = false } = props;
  const { t } = useTranslation("projects");

  const projectTicketTags = project?.ticketTags ?? [];
  const selectedTagIds = ticket.tagIds ?? [];
  const isBlocked = ticket.status.trim().toLowerCase() === "blocked";

  const ticketByShorthand = new Map(tickets.map((projectTicket) => [projectTicket.shorthand, projectTicket]));
  const blockedReason = ticket.blockedReason?.trim() || "-";
  const parentReference = resolveParentTicketReference(tickets, ticket.parentId);

  const buildTicketLinks = (value: string | null | undefined) => {
    const shorthands = parseShorthands(value);

    if (shorthands.length === 0) {
      return (
        <Button size="sm" variant="subtle" disabled>
          {t("ticketPanel.none")}
        </Button>
      );
    }

    return (
      <Flex gap="1" flexWrap="wrap">
        {shorthands.map((shorthand) => {
          const resolvedTicket = ticketByShorthand.get(shorthand);
          const canSelect = Boolean(resolvedTicket) && Boolean(onSelectTicket);

          return (
            <TicketLink
              key={shorthand}
              label={shorthand}
              title={resolvedTicket?.title ?? shorthand}
              onSelect={() => resolvedTicket && onSelectTicket?.(resolvedTicket.id)}
              isDisabled={!canSelect}
            />
          );
        })}
      </Flex>
    );
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const tagItems = projectTicketTags.map((tag) => ({
    id: `tag-${tag.id}`,
    name: capitalize(tag.name),
    type: "property" as const,
    value: (
      <SingleTagSelector
        tag={tag}
        selectedOptionIds={selectedTagIds}
        onChange={onTagIdsChange}
        isDisabled={isUpdatingTags}
      />
    ),
  }));

  return (
    <ItemSection title={t("ticketPanel.properties.title")}>
      <Box p="sm">
        <ParamEditor
          params={[
            { id: "id", name: t("ticketPanel.fields.id"), type: "property", value: ticket.shorthand },
            {
              id: "updated",
              name: t("ticketPanel.fields.updated"),
              type: "property",
              value: getTimeFormat(ticket.updatedAt),
            },
            { id: "status", name: t("ticketPanel.fields.status"), type: "property", value: ticket.status },
            ...(ticket.archived
              ? [{ id: "archived", name: t("ticketPanel.fields.archived"), type: "property" as const, value: "Yes" }]
              : []),
            ...(isBlocked
              ? [
                  {
                    id: "blocked-reason",
                    name: t("ticketPanel.fields.blockedReason"),
                    type: "property" as const,
                    value: blockedReason,
                  },
                ]
              : []),
            {
              id: "depends-on",
              name: t("ticketPanel.fields.dependsOn"),
              type: "property",
              value: buildTicketLinks(ticket.dependsOn),
            },
            {
              id: "parent",
              name: t("ticketPanel.fields.parent"),
              type: "property",
              value: parentReference.shorthand ? (
                <TicketLink
                  label={parentReference.shorthand}
                  title={parentReference.ticket?.title ?? parentReference.shorthand}
                  onSelect={() => parentReference.ticket && onSelectTicket?.(parentReference.ticket.id)}
                  isDisabled={!parentReference.ticket || !onSelectTicket}
                />
              ) : (
                <Button size="sm" variant="subtle" disabled>
                  {t("ticketPanel.none")}
                </Button>
              ),
            },
            ...tagItems,
          ]}
        />
      </Box>
    </ItemSection>
  );
};
