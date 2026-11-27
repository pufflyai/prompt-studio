import { Button } from "@chakra-ui/react";
import { ActionErrorSlot, AlertMessage } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export interface ExtensionActionState {
  operation?: "toggle";
  enabled?: boolean;
  retryable?: boolean;
  needsReview?: boolean;
  localEditsConfirmed?: boolean;
  status: "queued" | "running" | "error";
  label: string;
  error?: string;
}

interface ExtensionActionFeedbackProps {
  action?: ExtensionActionState;
  onDismiss?: () => void;
  onRetry?: () => void;
  retryDisabled?: boolean;
}

export const ExtensionActionFeedback = (props: ExtensionActionFeedbackProps) => {
  const { action, onDismiss, onRetry, retryDisabled } = props;
  const { t } = useTranslation("projects");
  if (action?.status !== "error") return null;

  const retryLabel = () => {
    if (!action.needsReview) return t("projectSettings.extensionsPanel.feedback.retry", "Retry");
    return action.localEditsConfirmed
      ? t("projectSettings.extensionsPanel.upgrade.resolve", "Resolve")
      : t("projectSettings.extensionsPanel.upgrade.chooseVersion", "Choose version");
  };
  return (
    <ActionErrorSlot edge="top">
      <AlertMessage
        compact
        status="error"
        title={action.label}
        onClose={onDismiss}
        endElement={
          action.retryable !== false &&
          onRetry && (
            <Button onClick={onRetry} disabled={retryDisabled}>
              {retryLabel()}
            </Button>
          )
        }
      >
        {action.error}
      </AlertMessage>
    </ActionErrorSlot>
  );
};
