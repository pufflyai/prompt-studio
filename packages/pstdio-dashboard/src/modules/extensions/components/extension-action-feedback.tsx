import { Button } from "@chakra-ui/react";
import { ActionErrorSlot, AlertMessage } from "@pstdio/ui";
import { useTranslation } from "react-i18next";

export interface ExtensionActionState {
  operation?: "toggle";
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

  return (
    <ActionErrorSlot edge="top">
      <AlertMessage
        compact
        status="error"
        title={action.label}
        onClose={onDismiss}
        endElement={
          onRetry && (
            <Button onClick={onRetry} disabled={retryDisabled}>
              {t("projectSettings.extensionsPanel.feedback.retry", "Retry")}
            </Button>
          )
        }
      >
        {action.error}
      </AlertMessage>
    </ActionErrorSlot>
  );
};
