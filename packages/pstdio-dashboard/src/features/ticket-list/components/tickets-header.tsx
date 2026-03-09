import { HStack, Input, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface TicketsHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export const TicketsHeader = (props: TicketsHeaderProps) => {
  const { searchQuery, onSearchChange } = props;
  const { t } = useTranslation("tickets");

  return (
    <HStack gap="sm" width="100%" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      <Text textStyle="label/M/medium" flexShrink={0}>
        {t("ticketListHeader.title")}
      </Text>
      <Input
        aria-label={t("ticketListHeader.searchAriaLabel")}
        placeholder={t("ticketListHeader.searchPlaceholder")}
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        maxW="360px"
      />
    </HStack>
  );
};
