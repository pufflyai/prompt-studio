import { Button, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import type { MarketplaceExtension } from "@pstdio/sdk/api";
import { ChevronRight, Download, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";

interface MarketplaceExtensionRowProps {
  extension: MarketplaceExtension;
  installing: boolean;
  onInstall: () => void;
  onOpen: () => void;
}

export const MarketplaceExtensionRow = (props: MarketplaceExtensionRowProps) => {
  const { extension, installing, onInstall, onOpen } = props;
  const { t } = useTranslation("projects");

  return (
    <HStack
      data-testid="marketplace-extension-entry"
      gap="md"
      paddingX="lg"
      paddingY="sm"
      borderBottomWidth="1px"
      borderColor="border.subtle"
      cursor="pointer"
      role="button"
      tabIndex={0}
      _hover={{ bg: "bg.subtle" }}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <Flex
        alignItems="center"
        justifyContent="center"
        boxSize="9"
        flexShrink="0"
        borderWidth="1px"
        borderColor="border.subtle"
        borderRadius="sm"
        bg="bg.subtle"
        color="fg.subtle"
      >
        <Puzzle size={18} />
      </Flex>
      <Stack gap="0" flex="1" minW="0">
        <HStack gap="sm" minW="0">
          <Text textStyle="label/S/medium" truncate>
            {extension.displayName}
          </Text>
          <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" flexShrink="0">
            {extension.installName}
          </Text>
        </HStack>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {extension.description}
        </Text>
      </Stack>
      <Button
        variant="outline"
        size="2xs"
        loading={installing}
        onClick={(event) => {
          event.stopPropagation();
          onInstall();
        }}
        data-testid="marketplace-extension-install"
      >
        <Download size={12} />
        {t("projectSettings.extensionsPanel.marketplace.install")}
      </Button>
      <Icon boxSize="4" color="fg.subtle" flexShrink="0">
        <ChevronRight />
      </Icon>
    </HStack>
  );
};
