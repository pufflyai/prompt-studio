import { Flex } from "@chakra-ui/react";
import { KanbanSquare } from "lucide-react";
import { useTranslation } from "react-i18next";

export const TicketsBreadcrumbTitle = () => {
  const { t } = useTranslation("projects");

  return (
    <Flex as="span" align="center" gap="2xs">
      <KanbanSquare size={14} />
      {t("sidebar.tickets")}
    </Flex>
  );
};
