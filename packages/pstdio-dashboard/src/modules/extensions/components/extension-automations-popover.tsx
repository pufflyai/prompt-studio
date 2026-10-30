import { Button, HStack, Icon, Popover, Portal, Stack, Text } from "@chakra-ui/react";
import type { WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";

export interface ExtensionAutomationsPopoverProps {
  extensionName: string;
  automations: WorkbenchExtensionAutomationRecord[];
}

export const ExtensionAutomationsPopover = (props: ExtensionAutomationsPopoverProps) => {
  const { extensionName, automations } = props;
  const { t } = useTranslation("projects");

  if (automations.length === 0) return null;

  const enabledCount = automations.filter((automation) => automation.enabled).length;

  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
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
          <Popover.Content width="320px" data-testid="extension-automations-popover">
            <Popover.Body padding="0">
              <Stack gap="0">
                <HStack paddingX="md" paddingY="sm" borderBottomWidth="1px" borderColor="border.subtle" gap="xs">
                  <Icon boxSize="3.5" color="fg.subtle">
                    <Timer />
                  </Icon>
                  <Text textStyle="label/S/medium">{t("projectSettings.extensionsPanel.automations.title")}</Text>
                  <Text textStyle="label/XS" color="fg.subtle" marginLeft="auto">
                    {extensionName}
                  </Text>
                </HStack>
                <Stack paddingX="md" paddingY="sm" gap="xs">
                  {automations.map((automation) => (
                    <HStack key={automation.id} gap="sm">
                      <Stack gap="0" flex="1" minW="0">
                        <Text textStyle="label/S/regular" truncate>
                          {resolveLocalizableString(automation.title, automation.extensionId)}
                        </Text>
                        <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" truncate>
                          {t("projectSettings.extensionsPanel.automations.cron", { cron: automation.cron })}
                        </Text>
                      </Stack>
                      <Text
                        textStyle="label/XS"
                        fontFamily="mono"
                        color={automation.enabled ? "fg.success" : "fg.subtle"}
                      >
                        {automation.enabled
                          ? t("projectSettings.extensionsPanel.automations.stateOn")
                          : t("projectSettings.extensionsPanel.automations.stateOff")}
                      </Text>
                    </HStack>
                  ))}
                </Stack>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
