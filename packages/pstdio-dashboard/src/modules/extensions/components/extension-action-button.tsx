import { ButtonGroup, IconButton, Spinner, Text } from "@chakra-ui/react";
import { ProgressButton, type ProgressButtonProps } from "@pstdio/ui";
import { ArrowUpCircle, CircleAlert, Clock, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionActionState } from "./extension-action-feedback";

interface ExtensionActionButtonProps extends Omit<ProgressButtonProps, "onClick"> {
  action?: ExtensionActionState;
  onAction?: () => void;
  onDismiss?: (action: ExtensionActionState) => void;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ReactNode;
  compact?: boolean;
}

export const ExtensionActionButton = (props: ExtensionActionButtonProps) => {
  const {
    action,
    onAction,
    onDismiss,
    onRetry,
    retryLabel,
    icon = <ArrowUpCircle />,
    compact,
    children,
    disabled,
    progress,
    ...rest
  } = props;
  const { t } = useTranslation("projects");
  const running = action?.status === "running";
  const queued = action?.status === "queued";
  const failed = action?.status === "error";
  const retryAction = action?.retryable === false ? undefined : onRetry;
  const label = action?.label;
  const retry =
    retryLabel ??
    (action?.needsReview
      ? t("projectSettings.extensionsPanel.upgrade.review", "Review upgrade")
      : t("projectSettings.extensionsPanel.feedback.retry", "Retry"));
  const error = action?.error === action?.label ? undefined : action?.error;
  const name = error ? `${label}: ${error}` : label;
  return (
    <ButtonGroup
      attached
      size={rest.size}
      variant={rest.variant}
      alignItems="stretch"
      minW={compact ? "14" : undefined}
      data-testid="extension-action-group"
    >
      <ProgressButton
        {...rest}
        status={action?.status}
        disabled={disabled || running || queued || (failed && !retryAction)}
        flexShrink={compact ? 1 : undefined}
        aria-busy={running || undefined}
        aria-label={failed && retryAction ? `${name} · ${retry}` : name}
        aria-live="polite"
        aria-atomic="true"
        progress={progress}
        onClick={failed ? retryAction : onAction}
      >
        <ActionIcon status={action?.status} icon={icon} />
        <Text as="span" truncate={compact} title={compact ? name : undefined}>
          {label ?? children}
          {error && (
            <Text as="span" role="alert">
              {" "}
              · {error}
            </Text>
          )}
          {failed && retryAction && ` · ${retry}`}
        </Text>
      </ProgressButton>
      {failed && onDismiss && (
        <IconButton
          height="auto"
          flexShrink={compact ? 0 : undefined}
          aria-label={`${t("projectSettings.extensionsPanel.feedback.dismiss", "Dismiss")} ${action.label}`}
          onClick={() => onDismiss(action)}
          data-testid="extension-action-dismiss"
        >
          <X />
        </IconButton>
      )}
    </ButtonGroup>
  );
};

const ActionIcon = ({ status, icon }: { status?: ExtensionActionState["status"]; icon: ReactNode }) => {
  if (status === "running") return <Spinner size="xs" />;
  if (status === "queued") return <Clock />;
  if (status === "error") return <CircleAlert />;
  return icon;
};
