import { Button } from "@chakra-ui/react";
import { RotateCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ExtensionActionButton } from "./extension-action-button";
import type { ExtensionDetailProps } from "./extension-detail";
import { ExtensionToggle } from "./extension-toggle";

interface ExtensionDetailControlsProps
  extends Pick<
    ExtensionDetailProps,
    | "extension"
    | "upgradeAction"
    | "onUpgrade"
    | "onDismissUpgrade"
    | "onRetryUpgrade"
    | "reloading"
    | "onReload"
    | "toggleAction"
    | "onToggle"
  > {
  changing: boolean;
  showReload: boolean;
}

export const ExtensionDetailControls = (props: ExtensionDetailControlsProps) => {
  const {
    extension,
    upgradeAction,
    onUpgrade,
    onDismissUpgrade,
    onRetryUpgrade,
    reloading,
    onReload,
    toggleAction,
    onToggle,
    changing,
    showReload,
  } = props;
  const { t } = useTranslation("projects");
  const sourceDisabled = changing || Boolean(extension.sourceRestriction);
  return (
    <>
      {(extension.canUpgrade || extension.hasPublishedAlternative || upgradeAction) && (
        <ExtensionActionButton
          variant="primary"
          size="2xs"
          onAction={onUpgrade}
          action={upgradeAction}
          onDismiss={onDismissUpgrade}
          onRetry={onRetryUpgrade}
          disabled={sourceDisabled}
          data-testid="extension-upgrade"
        >
          {extension.hasPublishedAlternative
            ? t("projectSettings.extensionsPanel.upgrade.publishedAlternative", "Review published version")
            : t("projectSettings.extensionsPanel.upgrade.action")}
        </ExtensionActionButton>
      )}
      {showReload && (
        <Button
          variant="primary"
          size="2xs"
          onClick={onReload}
          loading={reloading}
          disabled={sourceDisabled}
          data-testid="extension-reload"
          flexShrink="0"
        >
          <RotateCw size={12} />
          {t("projectSettings.extensionsPanel.reload.action")}
        </Button>
      )}
      <ExtensionToggle
        name={extension.displayName}
        enabled={extension.enabled}
        action={toggleAction}
        disabled={changing || Boolean(extension.choiceRestriction)}
        onToggle={onToggle}
      />
    </>
  );
};
