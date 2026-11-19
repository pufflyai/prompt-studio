import { Flex, HStack, Spinner, Stack, Tabs, Text } from "@chakra-ui/react";
import type { MarketplaceExtension } from "@pstdio/sdk/api";
import { Blocks, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageContentLayout } from "@/shared/components/page-content-layout";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionActionState } from "./extension-action-feedback";
import { ExtensionBackButton } from "./extension-back-button";
import { ExtensionContributions } from "./extension-contributions";
import { ExtensionIcon } from "./extension-icon";
import { ExtensionIdentity } from "./extension-identity";
import { ExtensionAuthorBadge } from "./extension-labels";

interface AvailableExtensionDetailProps {
  extension: MarketplaceExtension;
  onBack?: () => void;
  metadata: DashboardExtensionMetadata | undefined;
  contributionsError?: string;
  loadingContributions: boolean;
  action?: ExtensionActionState;
  onDismissAction?: (action: ExtensionActionState) => void;
  onRetryAction?: () => void;
  onInstall: () => void;
}

export const AvailableExtensionDetail = (props: AvailableExtensionDetailProps) => {
  const {
    extension,
    metadata,
    contributionsError,
    loadingContributions,
    action,
    onDismissAction,
    onRetryAction,
    onInstall,
  } = props;
  const { t } = useTranslation("projects");
  const extensionId =
    extension.extensionId ?? metadata?.extensions[0]?.id ?? extension.registry?.extensionId ?? extension.installName;
  const origin = extension.registry
    ? `${extension.registry.url}/${extension.registry.extensionId}`
    : `${extension.origin.url}@${extension.origin.ref}#${extension.origin.path}`;

  return (
    <Tabs.Root defaultValue="contributions" size="sm" tray h="full" minH="0">
      <PageContentLayout
        testId="available-extension-detail"
        header={
          <Stack gap="md">
            <Stack gap="md" paddingX="lg" paddingTop="lg">
              <ExtensionBackButton onBack={props.onBack} />
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
                  <ExtensionIcon name={extension.icon} size="md" />
                </Flex>
                <Stack gap="0" flex="1" minW="0">
                  <Text textStyle="heading/M">{extension.displayName}</Text>
                  <ExtensionAuthorBadge author={extension.author} />
                  <ExtensionIdentity value={extensionId} />
                  <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" truncate>
                    {extension.publisher ? `${extension.publisher} · ` : ""}
                    {origin}
                  </Text>
                </Stack>
                <ExtensionActionButton
                  variant="outline"
                  size="2xs"
                  icon={<Download />}
                  action={action}
                  onAction={onInstall}
                  onDismiss={onDismissAction}
                  onRetry={onRetryAction}
                  data-testid="available-extension-install"
                >
                  {t("projectSettings.extensionsPanel.marketplace.install")}
                </ExtensionActionButton>
              </HStack>

              <Text textStyle="paragraph/S/regular" color="fg.muted">
                {extension.description}
              </Text>
            </Stack>
            <Tabs.List>
              <Tabs.Trigger value="contributions">
                <Blocks size={14} />
                {t("projectSettings.extensionsPanel.detail.tabs.contributions")}
              </Tabs.Trigger>
            </Tabs.List>
          </Stack>
        }
      >
        <Tabs.Content value="contributions">
          <Stack paddingX="lg">
            {loadingContributions && <Spinner size="sm" />}
            {!loadingContributions && contributionsError && (
              <Text textStyle="label/XS" color="fg.muted">
                {contributionsError}
              </Text>
            )}
            {!loadingContributions && !contributionsError && (
              <ExtensionContributions
                metadata={metadata}
                extensionId={metadata?.extensions[0]?.id ?? extensionId}
                automations={[]}
              />
            )}
          </Stack>
        </Tabs.Content>
      </PageContentLayout>
    </Tabs.Root>
  );
};
