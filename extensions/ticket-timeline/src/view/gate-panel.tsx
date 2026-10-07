// Explain the free-form agent review and let a failed or completed run be relaunched while the gate is open.
import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { PlanRow } from "../contracts";
import { Instructions } from "./instructions";
import type { PlanClient } from "./use-plan";

export function GatePanel({ row, client }: { row: PlanRow; client: PlanClient }) {
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string>();
  const launch = async () => {
    setLaunching(true);
    setError(undefined);
    try {
      await client.commands["gate.launch"]({ ticket: row.id });
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLaunching(false);
    }
  };
  return (
    <Stack
      gap="xs"
      p="sm"
      borderWidth="1px"
      borderStyle="dashed"
      borderColor="border.accent/40"
      borderRadius="md"
      bg="bg.subtle"
    >
      <Text textStyle="label/S/medium" color="fg.accent">
        AGENT GATE
      </Text>
      <Text textStyle="label/S/regular" color="fg.muted">
        The agent reviews dependencies and milestones, then updates the plan using these instructions.
      </Text>
      <Instructions text={row.instructions} />
      {!row.done ? (
        <Button size="sm" variant="outline" loading={launching} onClick={() => void launch()}>
          Review gate
        </Button>
      ) : null}
      {error ? (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
