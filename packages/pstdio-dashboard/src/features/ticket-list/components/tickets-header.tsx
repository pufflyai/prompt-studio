import { HStack, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

export const TicketsHeader = () => {
  const { t } = useTranslation("tickets");

  return (
    <HStack gap="sm" width="100%" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      <Text textStyle="label/M/medium" flexShrink={0}>
        {t("ticketListHeader.title")}
      </Text>
    </HStack>
  );
};
