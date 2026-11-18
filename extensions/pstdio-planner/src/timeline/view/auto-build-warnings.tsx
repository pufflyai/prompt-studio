import { Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import type { AutoBuildButtonProps } from "./auto-build-button";

type AutoBuildAlertProps = Pick<AutoBuildButtonProps, "error" | "actionError" | "onDismissActionError" | "t"> & {
  failed: boolean;
};

export function AutoBuildAlert(props: AutoBuildAlertProps) {
  const { actionError, error, failed, onDismissActionError, t } = props;
  const [dismissed, setDismissed] = useState<string>();
  const alert =
    actionError ??
    (failed
      ? (error ?? t("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error."))
      : undefined);
  const dismissAction = actionError ? onDismissActionError : undefined;
  if (dismissed && dismissed !== alert) setDismissed(undefined);
  if (!alert || (!dismissAction && alert === dismissed)) return null;
  return (
    <AlertMessage
      size="sm"
      role="alert"
      status="error"
      title={alert}
      position="absolute"
      top="0"
      insetInline="0"
      maxH="full"
      onClose={dismissAction ?? (() => setDismissed(alert))}
    />
  );
}

type AutoBuildWarningsProps = Pick<
  AutoBuildButtonProps,
  "enabled" | "completed" | "supervisor" | "error" | "stuck" | "matchingTicketCount" | "starting" | "t"
> & { failed: boolean };

export function AutoBuildWarnings(props: AutoBuildWarningsProps) {
  const { enabled, completed, supervisor, error, stuck, matchingTicketCount, starting, failed, t } = props;
  const noMatches = enabled && !completed && !starting && matchingTicketCount === 0;
  const needsHelp = !failed && !completed && (stuck || supervisor?.status === "awaiting_input");
  return (
    <>
      {needsHelp ? (
        <Text textStyle="paragraph/S/regular" title={error}>
          {t("timeline.autoBuild.stuck", "Auto Build is stuck. Check dependencies, blockers, and review requests.")}
        </Text>
      ) : null}
      {noMatches ? (
        <Text textStyle="paragraph/S/regular">
          {t(
            "timeline.autoBuild.noMatchingTickets",
            "No unfinished tickets match the current scope and eligible filters. Stop Auto Build to change them, or add matching tickets.",
          )}
        </Text>
      ) : null}
    </>
  );
}
