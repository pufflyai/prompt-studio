import { ButtonGroup, IconButton, Spinner, Text } from "@chakra-ui/react";
import { ProgressButton, type ProgressButtonProps } from "@pstdio/ui";
import { ArrowUpCircle, Check, CircleAlert, Clock, X } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionActionState } from "./extension-action-feedback";

interface ExtensionActionButtonProps extends Omit<ProgressButtonProps, "onClick"> {
  action?: ExtensionActionState;
  onAction?: () => void;
  onDismiss?: (action: ExtensionActionState) => void;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ReactNode;
}

export const ExtensionActionButton = (props: ExtensionActionButtonProps) => {
  const {
    action,
    onAction,
    onDismiss,
    onRetry,
    retryLabel,
    icon = <ArrowUpCircle />,
    children,
    disabled,
    progress,
    ...rest
  } = props;
  const { t } = useTranslation("projects");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (action?.status !== "running") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [action?.status]);
  const running = action?.status === "running";
  const queued = action?.status === "queued";
  const final = action?.status === "success" || action?.status === "error";
  const failed = action?.status === "error";
  const elapsed =
    running && action.startedAt !== undefined ? Math.max(0, Math.floor((now - action.startedAt) / 1000)) : undefined;
  const label = action ? `${action.label}${elapsed === undefined ? "" : ` · ${elapsed}s`}` : undefined;
  const retry = retryLabel ?? t("projectSettings.extensionsPanel.feedback.retry", "Retry");
  const error = action?.error === action?.label ? undefined : action?.error;
  const name = error ? `${label}: ${error}` : label;
  return (
    <ButtonGroup
      attached
      size={rest.size}
      variant={rest.variant}
      alignItems="stretch"
      data-testid="extension-action-group"
    >
      <ProgressButton
        {...rest}
        status={action?.status}
        disabled={running || queued || (final ? !failed || !onRetry : disabled)}
        aria-busy={running || undefined}
        aria-label={failed && onRetry ? `${name} · ${retry}` : name}
        aria-live="polite"
        aria-atomic="true"
        progress={progress}
        onClick={failed ? onRetry : onAction}
      >
        <ActionIcon status={action?.status} icon={icon} />
        <Text as="span">
          {label ?? children}
          {error && (
            <Text as="span" role="alert">
              {" "}
              · {error}
            </Text>
          )}
          {failed && onRetry && ` · ${retry}`}
        </Text>
      </ProgressButton>
      {final && onDismiss && (
        <IconButton
          height="auto"
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
  if (status === "success") return <Check />;
  if (status === "error") return <CircleAlert />;
  return icon;
};
