import { Box, Flex, HStack, Icon, IconButton, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import { Switch, type SwitchProps, Tooltip } from "@pstdio/ui";
import { ArrowUpCircle, Folder, Globe } from "lucide-react";
import type { AgentInfo } from "pstdio-api-contracts";
import { useTranslation } from "react-i18next";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";
import { ExtensionAutomationsPopover } from "./extension-automations-popover";
import { ExtensionHealthPopover } from "./extension-health-popover";
import { ExtensionIcon } from "./extension-icon";
import { ExtensionIdentity } from "./extension-identity";

export interface ExtensionListRowProps {
  extension: ProjectExtensionInstance;
  diagnostics: ExtensionDiagnostic[];
  automations: WorkbenchExtensionAutomationRecord[];
  unavailableHarnesses?: AgentInfo[];
  toggling: boolean;
  upgrading: boolean;
  action?: ExtensionActionState;
  onDismissAction?: () => void;
  onRetryAction?: () => void;
  togglingAutomation?: boolean;
  onToggle: (enabled: boolean) => void;
  onToggleAutomation: (automation: WorkbenchExtensionAutomationRecord, enabled: boolean) => Promise<unknown>;
  onUpgrade: () => void;
  onOpen: () => void;
}

const stopRowClick = (event: { stopPropagation: () => void }) => event.stopPropagation();

export const ExtensionListRow = (props: ExtensionListRowProps) => {
  const {
    extension,
    diagnostics,
    automations,
    unavailableHarnesses = [],
    toggling,
    upgrading,
    action,
    onDismissAction,
    onRetryAction,
    togglingAutomation,
    onToggle,
    onToggleAutomation,
    onUpgrade,
    onOpen,
  } = props;
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
        color={extension.enabled ? "fg" : "fg.subtle"}
      >
        <ExtensionIcon name={extension.icon} />
      </Flex>

      <Stack gap="0" flex="1" minW="0">
        <HStack gap="sm" minW="0">
          <Text textStyle="label/S/medium" color={extension.enabled ? "fg" : "fg.muted"} truncate>
            {extension.displayName}
          </Text>
          {extension.version && <ExtensionIdentity value={`v${extension.version}`} />}
        </HStack>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {extension.description ?? t("projectSettings.extensionsPanel.noDescription")}
        </Text>
        <Box onClick={stopRowClick} onKeyDown={stopRowClick}>
          <ExtensionActionFeedback action={action} onDismiss={onDismissAction} onRetry={onRetryAction} />
        </Box>
      </Stack>

      <Box
        w="64px"
        flexShrink="0"
        display="flex"
        justifyContent="flex-end"
        onClick={stopRowClick}
        data-testid="extension-automation-status"
      >
        <ExtensionAutomationsPopover
          automations={automations}
          togglingAutomation={togglingAutomation}
          onToggleAutomation={onToggleAutomation}
        />
      </Box>

      <Box
        w="52px"
        flexShrink="0"
        display="flex"
        justifyContent="flex-end"
        onClick={stopRowClick}
        onKeyDown={stopRowClick}
      >
        <ExtensionHealthPopover
          extension={extension}
          diagnostics={diagnostics}
          unavailableHarnesses={unavailableHarnesses}
          upgrading={upgrading}
          onUpgrade={onUpgrade}
        />
      </Box>

      {/* The slot stays when there is nothing to upgrade, so the switches line up across rows. The row
          opens on Enter, so a key press on the button must not reach it either. */}
      <Box boxSize="6" flexShrink="0" onClick={stopRowClick} onKeyDown={stopRowClick}>
        {extension.canUpgrade && (
          <Tooltip content={t("projectSettings.extensionsPanel.upgrade.action")}>
            <IconButton
              variant="ghost"
              size="2xs"
              loading={upgrading}
              onClick={onUpgrade}
              aria-label={t("projectSettings.extensionsPanel.upgrade.action")}
              data-testid="extension-row-upgrade"
            >
              <ArrowUpCircle />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <HStack gap="2xs" w="72px" flexShrink="0" justifyContent="flex-end" color="fg.subtle">
        <Icon boxSize="3.5">{extension.scope === "repo" ? <Folder /> : <Globe />}</Icon>
        <Text textStyle="label/XS" fontFamily="mono">
          {t(`projectSettings.extensionsPanel.scope.${extension.scope}`)}
        </Text>
      </HStack>

      <Box flexShrink="0" onClick={stopRowClick}>
        <Switch
          size="sm"
          checked={extension.enabled}
          onCheckedChange={handleCheckedChange}
          disabled={toggling || upgrading}
          aria-label={t("projectSettings.extensionsPanel.toggleAriaLabel", { name: extension.displayName })}
        />
      </Box>
    </HStack>
  );
};
