import { Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { ScopedPopover as Popover, PopoverHeader, Portal, ScrollArea, Switch } from "@pstdio/ui";
import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useActionError } from "@/shared/components/use-action-error";
import { createExtensionStringResolver } from "@/shared/extensions/extension-localization";

export interface ExtensionAutomationsPopoverProps {
  projectId?: string;
  automations: WorkbenchExtensionAutomationRecord[];
  togglingAutomation?: boolean;
  onToggleAutomation: (automation: WorkbenchExtensionAutomationRecord, enabled: boolean) => Promise<unknown>;
}

export const ExtensionAutomationsPopover = (props: ExtensionAutomationsPopoverProps) => {
  const { automations, togglingAutomation = false, onToggleAutomation } = props;
  const resolveString = createExtensionStringResolver(getRuntimeCollections(), props.projectId);
  const { t } = useTranslation("projects");
  const { showError, errorNotice, clearError } = useActionError();

  const handleToggle = async (automation: WorkbenchExtensionAutomationRecord, enabled: boolean) => {
    clearError();
    try {
      await onToggleAutomation(automation, enabled);
    } catch (error) {
      showError({ title: error instanceof Error ? error.message : String(error) });
    }
  };

  if (automations.length === 0) return null;

  const enabledCount = automations.filter((automation) => automation.enabled).length;

  return (
    <Popover.Root variant="widget" positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="2xs"
          color="fg.subtle"
          gap="2xs"
          data-testid="extension-automations-trigger"
          aria-label={t("projectSettings.extensionsPanel.automations.listStatus", {
            enabled: enabledCount,
            count: automations.length,
          })}
        >
          <Icon boxSize="3.5">
            <Timer />
          </Icon>
          <Text textStyle="label/XS" fontFamily="mono">
            {enabledCount}/{automations.length}
          </Text>
        </Button>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content
            width="popover-panel"
            maxW="calc(100vw - var(--chakra-spacing-md) * 2)"
            display="flex"
            flexDirection="column"
            maxH="min({sizes.filter-picker-height}, var(--available-height))"
            data-testid="extension-automations-popover"
          >
            <PopoverHeader
              icon={<Timer />}
              title={<Popover.Title>{t("projectSettings.extensionsPanel.automations.title")}</Popover.Title>}
            />
            <Popover.Body display="flex" flexDirection="column" minH="0" flex="1" p="0">
              <ScrollArea flex="1" minH="0" h="0" viewportProps={{ minH: "0", flex: "1" }}>
                <Stack padding="sm" gap="sm">
                  {errorNotice}
                  {automations.map((automation) => (
                    <HStack key={automation.id} gap="md" paddingX="sm" paddingY="xs">
                      <Stack gap="0" flex="1" minW="0">
                        <Text textStyle="label/S/regular" truncate>
                          {resolveString(automation.title, automation.extensionId)}
                        </Text>
                        <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" truncate>
                          {t("projectSettings.extensionsPanel.automations.cron", { cron: automation.cron })}
                        </Text>
                      </Stack>
                      <Switch
                        size="sm"
                        checked={automation.enabled}
                        disabled={togglingAutomation}
                        onCheckedChange={(details) => void handleToggle(automation, details.checked)}
                        aria-label={t("projectSettings.extensionsPanel.automations.toggleAriaLabel", {
                          name: resolveString(automation.title, automation.extensionId),
                        })}
                      />
                    </HStack>
                  ))}
                </Stack>
              </ScrollArea>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
