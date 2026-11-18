import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type { MarketplaceExtension } from "@pstdio/sdk/api";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import { ExtensionIcon } from "./extension-icon";

interface MarketplaceExtensionRowProps {
  extension: MarketplaceExtension;
  action?: ExtensionActionState;
  onDismissAction?: (action: ExtensionActionState) => void;
  onRetryAction?: () => void;
  onInstall: () => void;
  onOpen: () => void;
}

export const MarketplaceExtensionRow = (props: MarketplaceExtensionRowProps) => {
  const { extension, action, onDismissAction, onRetryAction, onInstall, onOpen } = props;
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
        <ExtensionIcon name={extension.icon} />
      </Flex>
      <Stack gap="0" flex="1" minW="0">
        <Text textStyle="label/S/medium" truncate>
          {extension.displayName}
        </Text>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {extension.description}
        </Text>
        <Text textStyle="label/XS" color="fg.subtle" fontFamily="mono" truncate>
          {extension.publisher ? `${extension.publisher} · ` : ""}
          {extension.origin.url}@{extension.origin.ref}#{extension.origin.path}
        </Text>
      </Stack>
      <Box onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <ExtensionActionButton
          variant="outline"
          size="2xs"
          icon={<Download />}
          action={action}
          onAction={onInstall}
          onDismiss={onDismissAction}
          onRetry={onRetryAction}
          data-testid="marketplace-extension-install"
        >
          {t("projectSettings.extensionsPanel.marketplace.install")}
        </ExtensionActionButton>
      </Box>
    </HStack>
  );
};
