import { Flex, HStack } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";
import { ExtensionMenuSlot } from "@/shared/extensions/components/extension-menu-slot";
import {
  type HeaderActionItem,
  HeaderActions,
  mergeHeaderOverflowActions,
} from "@/shared/extensions/components/header-actions";
import { useExtensionHeaderActions } from "@/shared/extensions/hooks/use-extension-header-actions";
import type { ExtensionResourceContext } from "@/shared/extensions/types";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
import { TICKET_SIDEBAR_STORAGE_KEY } from "./ticket-sidebar";

interface TicketHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  defaultOverflowActions?: HeaderActionItem[];
  pendingActionKeys?: string[];
  resource?: ExtensionResourceContext;
  onNavigateBack: () => void;
}

export const TicketHeader = (props: TicketHeaderProps) => {
  const { breadcrumbItems, defaultOverflowActions, pendingActionKeys, resource, onNavigateBack } = props;
  const { t } = useTranslation("projects");
  const ticketOverflowActions = useExtensionHeaderActions({ slotId: "ticket.headerOverflow", resource });
  const projectOverflowActions = useExtensionHeaderActions({ slotId: "project.headerOverflow" });
  const ticketListBreadcrumb: BreadcrumbItem = {
    title: <TicketsBreadcrumbTitle />,
    onClick: onNavigateBack,
  };
  const items = [ticketListBreadcrumb, ...breadcrumbItems];
  const mergedOverflow = mergeHeaderOverflowActions({
    customActions: [...ticketOverflowActions.actions, ...projectOverflowActions.actions],
    defaultActions: defaultOverflowActions,
  });
  const mergedPendingActionKeys = [
    ...(pendingActionKeys ?? []),
    ...ticketOverflowActions.pendingActionKeys,
    ...projectOverflowActions.pendingActionKeys,
  ];

  return (
    <>
      <HorizontalMenuStack>
        <Flex align="center" gap="sm" minW="0">
          <OpenSidebarButton storageKey={TICKET_SIDEBAR_STORAGE_KEY} />
          <Breadcrumb separator="/" separatorGap="xs" items={items} linkComponent={Link} />
        </Flex>

        <HStack gap="2xs" flexShrink={0}>
          <ExtensionMenuSlot slotId="ticket.headerPrimary" mode="buttons" resource={resource} />
          <ExtensionMenuSlot slotId="project.headerPrimary" mode="buttons" />
          <HeaderActions
            overflowActions={mergedOverflow}
            pendingActionKeys={mergedPendingActionKeys}
            overflowLabel={t("projects:ticketPanel.options.ticket")}
          />
        </HStack>
      </HorizontalMenuStack>
      {ticketOverflowActions.paramsDialog}
      {projectOverflowActions.paramsDialog}
    </>
  );
};
