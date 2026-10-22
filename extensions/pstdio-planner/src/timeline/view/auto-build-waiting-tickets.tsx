import { Stack, Text } from "@chakra-ui/react";
import type { AutoBuildButtonProps } from "./auto-build-button";

interface AutoBuildWaitingTicketsProps {
  tickets: NonNullable<AutoBuildButtonProps["waitingTickets"]>;
  t: AutoBuildButtonProps["t"];
}

export function AutoBuildWaitingTickets(props: AutoBuildWaitingTicketsProps) {
  const { tickets, t } = props;
  return (
    <Stack gap="xs">
      <Text textStyle="paragraph/S/regular">
        {t(
          "timeline.autoBuild.noReadyTickets",
          "No tickets are ready to start. Auto Build will resume when new work is available.",
        )}
      </Text>
      {tickets.map((ticket) => {
        let reason =
          ticket.detail ??
          t("timeline.autoBuild.waitingWork", "Waiting for prerequisites or available agent capacity.");
        if (ticket.reason === "existing-attempt")
          reason = t("timeline.autoBuild.existingWork", "Work already exists. Open the ticket to inspect it.");
        if (ticket.reason === "assigned")
          reason = t("timeline.autoBuild.assignedWork", "An agent is already working on this ticket.");
        return (
          <Text key={ticket.id} textStyle="paragraph/S/regular">
            {ticket.ticket} · {reason}
          </Text>
        );
      })}
    </Stack>
  );
}
