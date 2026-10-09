// Put human instructions and structured decisions first in the overview.
import { Box, Stack, Text } from "@chakra-ui/react";
import type { PlanRow } from "../contracts";
import { ActionForm } from "./action-form";
import { Instructions } from "./instructions";
import { LaunchActionButton } from "./launch-action-button";
import type { PlanClient } from "./use-plan";

export function ActionsPanel(props: { row: PlanRow; client: PlanClient }) {
  const { row, client } = props;
  const human = row.state === "await-input";
  return (
    <Stack gap="sm">
      <Text textStyle="label/S/medium" color="fg.muted">
        ACTIONS
      </Text>
      {human ? <LaunchActionButton ticket={row.id} client={client} /> : null}
      {row.actionErrors.map((error) => (
        <Text key={error} role="alert" color="fg.error">
          {error}
        </Text>
      ))}
      {row.actions.map((action) => (
        <ActionForm
          key={`${action.id}:${action.revision}`}
          action={action}
          ticket={row.id}
          client={client}
          completed={row.done}
        />
      ))}
      {human && !row.actions.length ? (
        <Box p="sm" bg="bg.subtle" borderRadius="md">
          <Instructions text={row.instructions || "Open the ticket to see the requested action."} />
        </Box>
      ) : null}
      {!human && !row.actions.length && !row.actionErrors.length ? (
        <Text textStyle="label/S/regular" color="fg.muted">
          No human action requested.
        </Text>
      ) : null}
    </Stack>
  );
}
