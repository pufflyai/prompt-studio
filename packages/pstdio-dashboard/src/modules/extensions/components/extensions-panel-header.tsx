import { HStack, Icon, Input, InputGroup, Stack, Text } from "@chakra-ui/react";
import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionFilters } from "./extension-filters";
import { wideExtensionPanel } from "./extension-layout";

interface ExtensionsPanelHeaderProps {
  searchRef?: (node: HTMLInputElement | null) => void;
  filters: ExtensionFilters;
  onFiltersChange: (filters: ExtensionFilters) => void;
  upgrade: ReactNode;
}

export const ExtensionsPanelHeader = ({ searchRef, filters, onFiltersChange, upgrade }: ExtensionsPanelHeaderProps) => {
  const { t } = useTranslation("projects");
  const key = "projectSettings.extensionsPanel";
  return (
    <Stack bg="bg" gap="0">
      <Stack padding="lg" gap="md" borderBottomWidth="1px" borderColor="border.subtle">
        <HStack justify="space-between" gap="md" flexWrap="wrap">
          <Text textStyle="heading/M" flex="1">
            {t(`${key}.title`)}
          </Text>
          {upgrade}
          <InputGroup startElement={<Icon as={Search} boxSize="3.5" />} w={{ base: "full", sm: "64" }} maxW="full">
            <Input
              ref={searchRef}
              size="sm"
              value={filters.search}
              placeholder={t(`${key}.searchPlaceholder`)}
              aria-label={t(`${key}.searchPlaceholder`)}
              data-testid="extensions-search"
              onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            />
          </InputGroup>
        </HStack>
      </Stack>
      <HStack
        paddingX="lg"
        paddingY="sm"
        gap="md"
        borderBottomWidth="1px"
        borderColor="border.subtle"
        color="fg.subtle"
      >
        <Text textStyle="label/XS/medium" flex="1">
          {t(`${key}.columns.extension`)}
        </Text>
        <HStack display="none" css={{ [wideExtensionPanel]: { display: "flex" } }} gap="md">
          <Text textStyle="label/XS/medium" w="28">
            {t(`${key}.author.label`)}
          </Text>
          <Text textStyle="label/XS/medium" w="28">
            {t(`${key}.scope.label`)}
          </Text>
          <Text textStyle="label/XS/medium" w="16" textAlign="end">
            {t(`${key}.columns.enabled`)}
          </Text>
        </HStack>
      </HStack>
    </Stack>
  );
};
