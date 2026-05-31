import { Flex, IconButton, Popover, Portal } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import { PanelRightOpen, SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Project } from "@/features/project/types";
import type { Ticket } from "@/features/ticket-list/types";
import { TicketProperties } from "./ticket-properties";

interface TicketDetailSidebarProps {
  ticket: Ticket;
  project: Project | null | undefined;
  allTickets: Ticket[];
  isOpen: boolean;
  isUpdatingTags: boolean;
  onToggle: () => void;
  onSelectTicket: (ticketId: string) => void;
  onTagIdsChange: (tagIds: string[]) => void;
}

export const TicketDetailSidebar = (props: TicketDetailSidebarProps) => {
  const { ticket, project, allTickets, isOpen, isUpdatingTags, onToggle, onSelectTicket, onTagIdsChange } = props;
  const { t } = useTranslation("tickets");
  const collapsedPanelRef = useRef<HTMLDivElement | null>(null);
  const [isCollapsedPopoverOpen, setCollapsedPopoverOpen] = useState(false);

  useEffect(() => {
    const container = collapsedPanelRef.current?.parentElement;
    if (!container) return;

    const closePopoverOnDesktop = () => {
      if (container.getBoundingClientRect().width > 620) {
        setCollapsedPopoverOpen(false);
      }
    };

    closePopoverOnDesktop();

    const observer = new ResizeObserver(closePopoverOnDesktop);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  const properties = (
    <TicketProperties
      ticket={ticket}
      project={project}
      tickets={allTickets}
      onSelectTicket={onSelectTicket}
      onTagIdsChange={onTagIdsChange}
      isUpdatingTags={isUpdatingTags}
    />
  );

  const collapsedPropertiesMenu = (
    <Flex
      ref={collapsedPanelRef}
      padding="2xs"
      minW="52px"
      justify="center"
      align="flex-start"
      display="none"
      css={{
        "@container (max-width: 620px)": {
          display: "flex",
        },
      }}
    >
      <Popover.Root
        lazyMount
        unmountOnExit
        open={isCollapsedPopoverOpen}
        positioning={{ placement: "bottom-end" }}
        onOpenChange={(details) => setCollapsedPopoverOpen(details.open)}
      >
        <Popover.Trigger asChild>
          <IconButton aria-label={t("projects:ticketPanel.properties.title")} variant="ghost" size="sm">
            <SlidersHorizontal />
          </IconButton>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content width="320px" maxW="calc(100vw - 32px)" bg="bg">
              <ScrollArea maxH="calc(100dvh - 32px)" contentProps={{ p: "xs" }}>
                {properties}
              </ScrollArea>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </Flex>
  );

  if (!isOpen) {
    return (
      <Flex borderLeftWidth="1px" padding="sm" minW="52px" justify="center" align="flex-start">
        <IconButton aria-label={t("ticketDetail.openDetailsPanel")} variant="ghost" size="sm" onClick={onToggle}>
          <PanelRightOpen />
        </IconButton>
      </Flex>
    );
  }

  return (
    <>
      <ScrollArea
        minW="320px"
        maxW="360px"
        css={{
          "@container (max-width: 620px)": {
            display: "none",
          },
        }}
        contentProps={{ display: "flex", flexDirection: "column", gap: "xs" }}
      >
        {properties}
      </ScrollArea>
      {collapsedPropertiesMenu}
    </>
  );
};
