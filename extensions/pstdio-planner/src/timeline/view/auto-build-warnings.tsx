import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import { useState } from "react";
import type { AutoBuildButtonProps } from "./auto-build-button";

interface AutoBuildWarningsProps
  extends Pick<
    AutoBuildButtonProps,
    | "enabled"
    | "completed"
    | "supervisor"
    | "error"
    | "actionError"
    | "onDismissActionError"
    | "stuck"
    | "matchingTicketCount"
    | "starting"
    | "t"
  > {
  failed: boolean;
}

export function AutoBuildWarnings(props: AutoBuildWarningsProps) {
  const { enabled, completed, supervisor, error, actionError, stuck, matchingTicketCount, starting, failed, t } = props;
  const noMatches = enabled && !completed && !starting && matchingTicketCount === 0;
  const needsHelp = failed || (!completed && (stuck || supervisor?.status === "awaiting_input"));
  const [dismissed, setDismissed] = useState<string>();
  const problem =
    error ?? t("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error.");
  const alert = actionError ?? (needsHelp && failed ? problem : undefined);
  const dismissAction = actionError ? props.onDismissActionError : undefined;
  if (dismissed && dismissed !== alert) setDismissed(undefined);
  if (!alert && !noMatches && !needsHelp) return null;
  return (
    <Stack gap="sm" position="relative" w="full">
      {alert && (dismissAction || alert !== dismissed) ? (
        <AlertMessage
          size="sm"
          role="alert"
          status="error"
          title={alert}
          position="absolute"
          bottom="100%"
          insetInline="0"
          maxH="8rem"
          zIndex="docked"
          onClose={dismissAction ?? (() => setDismissed(alert))}
        />
      ) : null}
      {needsHelp && !failed ? (
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
    </Stack>
  );
}
