import { Flex } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";
import { ExtensionMenuSlot } from "@/shared/extensions/components/extension-menu-slot";
import { useExtensionHeaderActions } from "@/shared/extensions/hooks/use-extension-header-actions";
import { OpenSidebarButton } from "@/shared/sidebar/open-sidebar-button";
import { TICKET_SIDEBAR_STORAGE_KEY } from "./ticket-sidebar";

interface TicketHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  pluginActions?: ActionDescriptor[];
  defaultOverflowActions?: HeaderActionItem[];
  pendingActionKeys?: string[];
  onNavigateBack: () => void;
  onPluginAction: (actionKey: string) => void;
}

export const TicketHeader = (props: TicketHeaderProps) => {
  const { breadcrumbItems, pluginActions, defaultOverflowActions, pendingActionKeys, onNavigateBack, onPluginAction } =
    props;
  const { t } = useTranslation("projects");
  const extensionOverflowActions = useExtensionHeaderActions({ slotId: "project.headerOverflow" });
  const ticketListBreadcrumb: BreadcrumbItem = {
    title: <TicketsBreadcrumbTitle />,
    onClick: onNavigateBack,
  };
  const items = [ticketListBreadcrumb, ...breadcrumbItems];
  const mergedOverflow = [...(defaultOverflowActions ?? []), ...extensionOverflowActions];

  return (
    <HorizontalMenuStack>
      <Flex align="center" gap="sm">
        <OpenSidebarButton storageKey={TICKET_SIDEBAR_STORAGE_KEY} />
        <Breadcrumb separator="/" separatorGap="xs" items={items} linkComponent={Link} />
      </Flex>

      <ExtensionMenuSlot slotId="project.headerPrimary" mode="buttons" />
      <PluginHeaderActions
        pluginActions={pluginActions}
        defaultOverflowActions={mergedOverflow}
        onPluginAction={onPluginAction}
        pendingActionKeys={pendingActionKeys}
        overflowLabel={t("projects:ticketPanel.options.ticket")}
      />
    </HorizontalMenuStack>
  );
};
