import { Button, HStack, Popover, Stack, Text } from "@chakra-ui/react";
import { Portal, ProgressButton, type ProgressButtonProps } from "@pstdio/ui";
import { ArrowUpCircle, Check, CircleAlert, Clock } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ExtensionActionState } from "./extension-action-feedback";

interface ExtensionActionButtonProps extends Omit<ProgressButtonProps, "onClick"> {
  action?: ExtensionActionState;
  onAction?: () => void;
  onDismiss?: (action: ExtensionActionState) => void;
  onRetry?: () => void;
  retryLabel?: string;
}

export const ExtensionActionButton = (props: ExtensionActionButtonProps) => {
  const { action, onAction, onDismiss, onRetry, retryLabel, children, disabled, progress, ...rest } = props;
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (action?.status !== "running") return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [action?.status]);
  const final = action?.status === "success" || action?.status === "error";
  const busy = action?.status === "queued" || action?.status === "running";
  const elapsed =
    action?.startedAt === undefined
      ? undefined
      : Math.max(0, Math.floor(((action.finishedAt ?? now) - action.startedAt) / 1000));
  const label = action ? `${action.label}${elapsed === undefined ? "" : ` · ${elapsed}s`}` : undefined;
  const button = (
    <ProgressButton
      {...rest}
      status={action?.status}
      disabled={busy || (!final && disabled)}
      aria-busy={busy || undefined}
      aria-label={label}
      aria-live="polite"
      aria-atomic="true"
      progress={progress ?? (action?.status === "running" ? { value: null, label: action.label } : undefined)}
      onClick={final ? undefined : onAction}
    >
      {action?.status === "error" && <CircleAlert />}
      {action?.status === "success" && <Check />}
      {action?.status === "queued" && <Clock />}
      {(!action || action.status === "running") && <ArrowUpCircle />}
      {label ?? children}
    </ProgressButton>
  );
  if (!final) return button;
  return (
    <ActionNotification action={action} onRetry={onRetry} onDismiss={onDismiss} retryLabel={retryLabel}>
      {button}
    </ActionNotification>
  );
};

interface ActionNotificationProps extends Pick<ExtensionActionButtonProps, "onRetry" | "onDismiss" | "retryLabel"> {
  action: ExtensionActionState;
  children: ReactNode;
}
const ActionNotification = (props: ActionNotificationProps) => {
  const { action, children, onRetry, onDismiss, retryLabel } = props;
  const { t } = useTranslation("projects");
  const [openedFor, setOpenedFor] = useState<ExtensionActionState>();
  return (
    <Popover.Root
      open={openedFor === action}
      onOpenChange={({ open }) => setOpenedFor(open ? action : undefined)}
      positioning={{ placement: "bottom-end" }}
    >
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content data-testid="extension-action-notification">
            <Popover.Body>
              <Stack gap="sm">
                <Popover.Title>{action.label}</Popover.Title>
                {action.error && (
                  <Text role="alert" whiteSpace="pre-wrap" wordBreak="break-word">
                    {action.error}
                  </Text>
                )}
                <HStack>
                  {onRetry && (
                    <Button
                      size="2xs"
                      onClick={() => {
                        setOpenedFor(undefined);
                        onRetry();
                      }}
                    >
                      {retryLabel ?? t("projectSettings.extensionsPanel.feedback.retry")}
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      size="2xs"
                      variant="ghost"
                      onClick={() => {
                        setOpenedFor(undefined);
                        onDismiss(action);
                      }}
                    >
                      {t("projectSettings.extensionsPanel.feedback.dismiss")}
                    </Button>
                  )}
                </HStack>
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  );
};
