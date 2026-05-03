import { Flex } from "@chakra-ui/react";
import type { BreadcrumbItem } from "@pstdio/ui";
import { Breadcrumb, HorizontalMenuStack } from "@pstdio/ui";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { type HeaderActionItem, HeaderActions } from "@/features/actions/header-actions";
import { TicketsBreadcrumbTitle } from "@/features/project/components/tickets-breadcrumb-title";

interface TicketHeaderProps {
  breadcrumbItems: BreadcrumbItem[];
  defaultOverflowActions?: HeaderActionItem[];
  pendingActionKeys?: string[];
  onNavigateBack: () => void;
}

export const TicketHeader = (props: TicketHeaderProps) => {
  const { breadcrumbItems, defaultOverflowActions, pendingActionKeys, onNavigateBack } = props;
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

      <HeaderActions
        actions={defaultOverflowActions}
        pendingActionKeys={pendingActionKeys}
        overflowLabel={t("projects:ticketPanel.options.ticket")}
      />
    </HorizontalMenuStack>
  );
};
