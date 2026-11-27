import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import type {
  ExtensionDiagnostic,
  ProjectExtensionInstance,
  WorkbenchExtensionAutomationRecord,
} from "@pstdio/sdk/api";
import type { AgentInfo } from "pstdio-api-contracts";
import { useTranslation } from "react-i18next";
import { ExtensionActionButton } from "./extension-action-button";
import { ExtensionActionFeedback, type ExtensionActionState } from "./extension-action-feedback";
import { ExtensionAutomationsPopover } from "./extension-automations-popover";
import { ExtensionHealthPopover } from "./extension-health-popover";
import { ExtensionIcon } from "./extension-icon";
import { ExtensionIdentity } from "./extension-identity";
import { ExtensionAuthorBadge, ExtensionScopeBadge } from "./extension-labels";
import { wideExtensionPanel } from "./extension-layout";
import { ExtensionManagementNotice } from "./extension-management-notice";
import { ExtensionToggle } from "./extension-toggle";

export interface ExtensionListRowProps {
  projectId?: string;
  rowRef?: (node: HTMLDivElement | null) => void;
  extension: ProjectExtensionInstance;
  diagnostics: ExtensionDiagnostic[];
  automations: WorkbenchExtensionAutomationRecord[];
  unavailableHarnesses?: AgentInfo[];
  action?: ExtensionActionState;
  sourceChanging?: boolean;
  onDismissAction?: (action: ExtensionActionState) => void;
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
    action,
    sourceChanging,
    onDismissAction,
    onRetryAction,
    togglingAutomation,
    onToggle,
    onToggleAutomation,
    onUpgrade,
    onOpen,
  } = props;
  const { t } = useTranslation("projects");
  const toggleAction = action?.operation === "toggle" ? action : undefined;
  const upgradeAction = toggleAction ? undefined : action;
  const toggling = toggleAction?.status === "running";
  const upgrading = upgradeAction?.status === "queued" || upgradeAction?.status === "running";
  const changing = toggling || upgrading || sourceChanging;

  return (
    <HStack
      ref={props.rowRef}
      data-testid="extension-entry"
      data-extension-id={extension.id}
      flexWrap="wrap"
      css={{ [wideExtensionPanel]: { flexWrap: "nowrap" } }}
      position="relative"
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
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
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

      <Stack gap="0" flex="1" minW="0" flexBasis="60%" css={{ [wideExtensionPanel]: { flexBasis: "0" } }}>
        <HStack gap="sm" minW="0">
          <Text textStyle="label/S/medium" color={extension.enabled ? "fg" : "fg.muted"} truncate>
            {extension.displayName}
          </Text>
          {extension.version && <ExtensionIdentity value={`v${extension.version}`} />}
          <Box flexShrink="0" display="flex" justifyContent="flex-end" onClick={stopRowClick} onKeyDown={stopRowClick}>
            <ExtensionHealthPopover
              extension={extension}
              diagnostics={diagnostics}
              unavailableHarnesses={unavailableHarnesses}
              upgrading={changing}
              onUpgrade={onUpgrade}
            />
          </Box>
        </HStack>
        <Text textStyle="label/XS" color="fg.muted" truncate>
          {extension.description ?? t("projectSettings.extensionsPanel.noDescription")}
        </Text>
        <ExtensionManagementNotice extension={extension} />
      </Stack>

      <Box
        display={automations.length ? "flex" : "none"}
        flexShrink="0"
        justifyContent="flex-end"
        onClick={stopRowClick}
        data-testid="extension-automation-status"
      >
        <ExtensionAutomationsPopover
          projectId={props.projectId}
          automations={automations}
          togglingAutomation={togglingAutomation || changing}
          onToggleAutomation={onToggleAutomation}
        />
      </Box>

      <Box flexShrink="0" onClick={stopRowClick} onKeyDown={stopRowClick}>
        {(extension.canUpgrade || extension.hasPublishedAlternative || upgradeAction) && (
          <ExtensionActionButton
            variant="outline"
            size="2xs"
            action={upgradeAction}
            onAction={onUpgrade}
            onDismiss={onDismissAction}
            onRetry={upgradeAction?.status === "error" ? onRetryAction : undefined}
            disabled={changing || Boolean(extension.sourceRestriction)}
            data-testid="extension-row-upgrade"
          >
            {extension.hasPublishedAlternative
              ? t("projectSettings.extensionsPanel.upgrade.publishedAlternative", "Review published version")
              : t("projectSettings.extensionsPanel.upgrade.action")}
          </ExtensionActionButton>
        )}
      </Box>

      <Box css={{ [wideExtensionPanel]: { width: "28" } }} maxW="full" minW="0" flexShrink="1">
        <ExtensionAuthorBadge author={extension.author} />
      </Box>
      <Box css={{ [wideExtensionPanel]: { width: "28" } }} flexShrink="0">
        <ExtensionScopeBadge scope={extension.scope} />
      </Box>

      <Box
        marginLeft="auto"
        css={{ [wideExtensionPanel]: { width: "16", marginLeft: "0" } }}
        display="flex"
        justifyContent="end"
        flexShrink="0"
        onClick={stopRowClick}
        onKeyDown={stopRowClick}
      >
        <ExtensionActionFeedback
          action={toggleAction}
          onDismiss={toggleAction && (() => onDismissAction?.(toggleAction))}
          onRetry={onRetryAction}
          retryDisabled={changing || Boolean(extension.choiceRestriction)}
        />
        <ExtensionToggle
          name={extension.displayName}
          enabled={extension.enabled}
          action={toggleAction}
          disabled={changing || Boolean(extension.choiceRestriction)}
          onToggle={onToggle}
        />
      </Box>
    </HStack>
  );
};
