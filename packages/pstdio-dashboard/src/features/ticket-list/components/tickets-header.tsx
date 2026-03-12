import { HStack, Input, Text } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";

interface TicketsHeaderProps {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

export const TicketsHeader = (props: TicketsHeaderProps) => {
  const { searchTerm, onSearchTermChange } = props;
  const { t } = useTranslation("tickets");

  return (
    <HStack gap="sm" width="100%" px="4" py="3" borderBottomWidth="1px" borderColor="border.muted">
      <Text textStyle="label/M/medium" flexShrink={0}>
        {t("ticketListHeader.title")}
      </Text>

      <Input
        value={searchTerm}
        onChange={(event) => onSearchTermChange(event.target.value)}
        placeholder={t("ticketListHeader.searchPlaceholder", { defaultValue: "Search tickets..." })}
        aria-label={t("ticketListHeader.searchPlaceholder", { defaultValue: "Search tickets..." })}
        maxW="320px"
        size="sm"
      />
    </HStack>
  );
};
