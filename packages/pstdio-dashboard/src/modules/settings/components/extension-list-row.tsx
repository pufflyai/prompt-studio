import { Box, Flex, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import type { ProjectExtensionInstance, WorkbenchExtensionAutomationRecord } from "@pstdio/sdk/api";
import { Switch, type SwitchProps } from "@pstdio/ui";
import { ArrowUpCircle, ChevronRight, Folder, Globe, Puzzle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExtensionAutomationsPopover } from "./extension-automations-popover";
import { ExtensionHealthPopover, type ExtensionHealthPopoverProps } from "./extension-health-popover";

export interface ExtensionListRowProps {
  extension: ProjectExtensionInstance;
  health: Omit<ExtensionHealthPopoverProps, "extension">;
  automations: WorkbenchExtensionAutomationRecord[];
  toggling: boolean;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
}

const stopRowClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

export const ExtensionListRow = (props: ExtensionListRowProps) => {
  const { extension, health, automations, toggling, onToggle, onOpen } = props;
  const { t } = useTranslation("projects");
  const handleCheckedChange: NonNullable<SwitchProps["onCheckedChange"]> = (details) => {
    onToggle(details.checked);
  };

  return (
    <HStack
      data-testid="extension-entry"
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
        color={extension.enabled ? "fg" : "fg.subtle"}
      >
        <Puzzle size={18} />
      </Flex>

      <Stack gap="0" flex="1" minW="0">
        <HStack gap="sm" minW="0">
          <Text textStyle="label/S/medium" color={extension.enabled ? "fg" : "fg.muted"} truncate>
            {extension.displayName}
          </Text>
          <Text textStyle="label/XS" fontFamily="mono" color="fg.subtle" flexShrink="0">
            {extension.extensionId}
            {extension.version ? ` · v${extension.version}` : ""}
          </Text>
          {extension.updateAvailable && (
            <HStack gap="2xs" flexShrink="0" color="fg.info" data-testid="extension-update-marker">
              <Icon boxSize="3.5">
                <ArrowUpCircle />
              </Icon>
              <Text textStyle="label/XS">{t("projectSettings.extensionsPanel.update.available")}</Text>
            </HStack>
          )}
        </HStack>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {extension.description ?? t("projectSettings.extensionsPanel.noDescription")}
        </Text>
      </Stack>

      <HStack gap="2xs" w="72px" flexShrink="0" color="fg.subtle">
        <Icon boxSize="3.5">{extension.scope === "repo" ? <Folder /> : <Globe />}</Icon>
        <Text textStyle="label/XS" fontFamily="mono">
          {t(`projectSettings.extensionsPanel.scope.${extension.scope}`)}
        </Text>
      </HStack>

      <Box
        w="64px"
        flexShrink="0"
        display="flex"
        justifyContent="flex-start"
        onClick={stopRowClick}
        data-testid="extension-automation-status"
      >
        <ExtensionAutomationsPopover extensionName={extension.displayName} automations={automations} />
      </Box>

      <Box w="52px" flexShrink="0" display="flex" justifyContent="flex-end" onClick={stopRowClick}>
        <ExtensionHealthPopover extension={extension} {...health} />
      </Box>

      <Box flexShrink="0" onClick={stopRowClick}>
        <Switch
          size="sm"
          checked={extension.enabled}
          onCheckedChange={handleCheckedChange}
          disabled={toggling}
          aria-label={t("projectSettings.extensionsPanel.toggleAriaLabel", { name: extension.displayName })}
        />
      </Box>

      <Icon boxSize="4" color="fg.subtle" flexShrink="0">
        <ChevronRight />
      </Icon>
    </HStack>
  );
};
