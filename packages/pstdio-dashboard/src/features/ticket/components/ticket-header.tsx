import { Flex } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { KanbanSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ActionDescriptor } from "@/features/plugin-actions/api";
import type { HeaderActionItem } from "@/features/plugin-actions/components/header-action-groups";
import { PluginHeaderActions } from "@/features/plugin-actions/components/plugin-header-actions";

interface TicketHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  pluginActions?: ActionDescriptor[];
  defaultOverflowActions?: HeaderActionItem[];
  pendingActionKey?: string | null;
  isExecuting?: boolean;
  onNavigateBack: () => void;
  onPluginAction: (actionKey: string) => void;
}

export const TicketHeader = (props: TicketHeaderProps) => {
  const {
    breadcrumbItems,
    pluginActions,
    defaultOverflowActions,
    pendingActionKey,
    isExecuting = false,
    onNavigateBack,
    onPluginAction,
  } = props;
  const { t } = useTranslation(["tickets", "projects"]);
  const ticketListBreadcrumb: BreadcrumbItem = {
    title: (
      <Flex as="span" align="center" gap="2xs">
        <KanbanSquare size={14} />
        {t("projects:sidebar.tickets")}
      </Flex>
    ),
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
        pendingActionKey={pendingActionKey}
        isExecuting={isExecuting}
        overflowLabel={t("projects:ticketPanel.options.ticket")}
      />
    </HorizontalMenuStack>
  );
};
