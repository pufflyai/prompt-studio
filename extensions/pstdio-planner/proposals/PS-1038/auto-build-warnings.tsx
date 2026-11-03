import { Stack, Text } from "@chakra-ui/react";
import { AlertMessage } from "@pstdio/ui";
import type { AutoBuildButtonProps } from "../../src/timeline/view/auto-build-button";

interface AutoBuildWarningsProps
  extends Pick<
    AutoBuildButtonProps,
    | "enabled"
    | "completed"
    | "supervisor"
    | "error"
    | "actionError"
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
  if (!actionError && !noMatches && !needsHelp) return null;
  return (
    <Stack gap="sm">
      {actionError ? <AlertMessage role="alert" status="error" title={actionError} /> : null}
      {needsHelp ? (
        <AlertMessage
          role="alert"
          status={failed ? "error" : "warning"}
          title={
            error ??
            (failed
              ? t("timeline.autoBuild.failed", "The supervisor failed. Open its session to inspect the error.")
              : t(
                  "timeline.autoBuild.stuck",
                  "Auto Build is stuck. Check dependencies, blockers, and review requests.",
                ))
          }
        />
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
