import { Flex } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";

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
  const ticketListBreadcrumb: BreadcrumbItem = {
    title: <TicketsBreadcrumbTitle />,
    onClick: onNavigateBack,
  };
  const items = [ticketListBreadcrumb, ...breadcrumbItems];

  return (
    <HorizontalMenuStack>
      <Flex align="center" gap="sm">
        <Breadcrumb separator="/" separatorGap="xs" items={items} linkComponent={Link} />
      </Flex>

      <PluginHeaderActions
        pluginActions={pluginActions}
        defaultOverflowActions={defaultOverflowActions}
        onPluginAction={onPluginAction}
        pendingActionKeys={pendingActionKeys}
        overflowLabel={t("projects:ticketPanel.options.ticket")}
      />
    </HorizontalMenuStack>
  );
};
