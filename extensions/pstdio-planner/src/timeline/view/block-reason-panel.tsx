// Show saved block reasons and prerequisite blockers in one consistent detail section.
import { Box, Stack, Text } from "@chakra-ui/react";
import type { PlanRow } from "../contracts";
import { blockReason } from "./block-reason";
import { Instructions } from "./instructions";

export function BlockReasonPanel(props: { row: PlanRow }) {
  const { row } = props;
  const reason = blockReason(row);
  return reason ? (
    <Stack gap="xs" role="region" aria-label="Blocked reason">
      <Text textStyle="label/S/medium" color="fg.muted">
        Blocked reason
      </Text>
      <Box p="sm" bg="red.subtle" color="red.fg" borderRadius="md">
        <Instructions text={reason} />
      </Box>
    </Stack>
  ) : null;
}
