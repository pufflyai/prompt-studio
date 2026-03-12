import { Button, Flex } from "@chakra-ui/react";
import { ItemSection, Properties } from "@pstdio/ui";
import { useTranslation } from "react-i18next";
import type { Project } from "@/features/project/types";
import type { Ticket } from "@/features/ticket-list/types";
import { getTimeFormat } from "../utils/time-format";
import { ComplexitySelector } from "./complexity-selector";
import { TagSelector } from "./tag-selector";
import { TicketLink } from "./ticket-link";

interface TicketPropertiesProps {
  ticket: Ticket;
  project?: Project | null;
  tickets?: Ticket[];
  onSelectTicket?: (ticketId: string) => void;
  onComplexityChange?: (complexity: Ticket["complexity"]) => void;
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
  const {
    ticket,
    project = null,
    tickets = [],
    onSelectTicket,
    onComplexityChange,
    onTagIdsChange,
    isUpdatingTags = false,
  } = props;
  const { t } = useTranslation("projects");

  const projectTicketTags = project?.ticketTags ?? [];
  const selectedTagIds = ticket.tagIds ?? [];
  const isBlocked = ticket.status.trim().toLowerCase() === "blocked";

  const ticketById = new Map(tickets.map((projectTicket) => [projectTicket.id, projectTicket]));
  const ticketByShorthand = new Map(tickets.map((projectTicket) => [projectTicket.shorthand, projectTicket]));
  const blockedReason = ticket.blockedReason?.trim() || "-";

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

  const parentTicket = ticket.parentId ? ticketById.get(ticket.parentId) : null;

  return (
    <ItemSection title={t("ticketPanel.properties.title")}>
      <Properties
        items={[
          { label: t("ticketPanel.fields.id"), value: ticket.shorthand },
          { label: t("ticketPanel.fields.updated"), value: getTimeFormat(ticket.updatedAt) },
          { label: t("ticketPanel.fields.status"), value: ticket.status },
          ...(ticket.archived ? [{ label: t("ticketPanel.fields.archived"), value: "Yes" }] : []),
          {
            label: t("ticketPanel.fields.complexity.label"),
            value: <ComplexitySelector value={ticket.complexity} onChange={onComplexityChange} />,
          },
          ...(isBlocked ? [{ label: t("ticketPanel.fields.blockedReason"), value: blockedReason }] : []),
          { label: t("ticketPanel.fields.dependsOn"), value: buildTicketLinks(ticket.dependsOn) },
          {
            label: t("ticketPanel.fields.parent"),
            value: parentTicket ? (
              <TicketLink
                label={parentTicket.shorthand}
                title={parentTicket.title}
                onSelect={() => onSelectTicket?.(parentTicket.id)}
                isDisabled={!onSelectTicket}
              />
            ) : (
              <Button size="sm" variant="subtle" disabled>
                {t("ticketPanel.none")}
              </Button>
            ),
          },
          {
            label: t("ticketPanel.fields.tags"),
            value: (
              <TagSelector
                tags={projectTicketTags}
                selectedTagIds={selectedTagIds}
                onChange={onTagIdsChange}
                isDisabled={isUpdatingTags}
              />
            ),
          },
        ]}
      />
    </ItemSection>
  );
};
