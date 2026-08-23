import { Button, Flex, HStack, Spinner, Stack, Tabs, Text } from "@chakra-ui/react";
import type { MarketplaceExtension } from "@pstdio/sdk/api";
import { ArrowLeft, Blocks, Download, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import { ExtensionContributions } from "./extension-contributions";

interface AvailableExtensionDetailProps {
  extension: MarketplaceExtension;
  metadata: DashboardExtensionMetadata | undefined;
  contributionsError?: string;
  loadingContributions: boolean;
  installing: boolean;
  onBack: () => void;
  onInstall: () => void;
}

export const AvailableExtensionDetail = (props: AvailableExtensionDetailProps) => {
  const { extension, metadata, contributionsError, loadingContributions, installing, onBack, onInstall } = props;
  const { t } = useTranslation("projects");
  const extensionId = metadata?.extensions[0]?.id ?? extension.installName;

  return (
    <Stack gap="md" paddingBottom="lg" data-testid="available-extension-detail">
      <Stack gap="md" paddingX="lg" paddingTop="lg">
        <HStack>
          <Button variant="ghost" size="2xs" onClick={onBack} data-testid="extension-detail-back">
            <ArrowLeft size={12} />
            {t("projectSettings.extensionsPanel.detail.back")}
          </Button>
        </HStack>

        <HStack gap="md" alignItems="center">
          <Flex
            alignItems="center"
            justifyContent="center"
            boxSize="11"
            flexShrink="0"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="sm"
            bg="bg.subtle"
          >
            <Puzzle size={22} />
          </Flex>
          <Stack gap="0" flex="1" minW="0">
            <Text textStyle="heading/M">{extension.displayName}</Text>
            <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle">
              {extension.installName}
            </Text>
          </Stack>
          <Button
            variant="outline"
            size="2xs"
            loading={installing}
            onClick={onInstall}
            data-testid="available-extension-install"
          >
            <Download size={12} />
            {t("projectSettings.extensionsPanel.marketplace.install")}
          </Button>
        </HStack>

        <Text textStyle="paragraph/S/regular" color="fg.muted">
          {extension.description}
        </Text>
      </Stack>

      <Tabs.Root defaultValue="contributions" size="sm" tray>
        <Tabs.List>
          <Tabs.Trigger value="contributions">
            <Blocks size={14} />
            {t("projectSettings.extensionsPanel.detail.tabs.contributions")}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="contributions">
          <Stack paddingX="lg">
            {loadingContributions && <Spinner size="sm" />}
            {!loadingContributions && contributionsError && (
              <Text textStyle="label/XS" color="fg.muted">
                {contributionsError}
              </Text>
            )}
            {!loadingContributions && !contributionsError && (
              <ExtensionContributions metadata={metadata} extensionId={extensionId} automations={[]} />
            )}
          </Stack>
        </Tabs.Content>
      </Tabs.Root>
    </Stack>
  );
};
