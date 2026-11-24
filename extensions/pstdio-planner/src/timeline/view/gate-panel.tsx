// Explain the free-form agent review and let a failed or completed run be relaunched while the gate is open.
import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { isLiveSession } from "../../commands/auto-build-sessions";
import type { PlanRow } from "../contracts";
import { isDefiniteGateLaunchRefusal } from "./gate-launch-recovery";
import { Instructions } from "./instructions";
import type { PlanClient } from "./use-plan";

export function GatePanel(props: { row: PlanRow; client: PlanClient }) {
  const { row, client } = props;
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string>();
  const [recovery, setRecovery] = useState<{
    ticketId: string;
    session?: { id: string; status: string };
    attemptId?: string;
  }>();
  const result = recovery?.ticketId === row.id ? recovery : undefined;
  const check = result && !result.session;
  const previous = result?.session && !isLiveSession(result.session) ? result.session.id : undefined;
  const reviewLabel = previous ? "Review again" : "Review gate";
  const launch = async () => {
    const attemptId = check ? result.attemptId : crypto.randomUUID();
    setLaunching(true);
    setError(undefined);
    try {
      if (check) {
        const current = await client.commands["timeline.gate.check-launch"]({ ticket: row.id, attemptId });
        if (current.status === "confirmed") setRecovery({ ticketId: row.id, session: current.session });
        if (current.status === "ready") setRecovery(undefined);
        if (current.status === "unconfirmed") setError("No review session has been confirmed yet.");
      } else {
        const session = await client.commands["timeline.gate.launch"]({
          ticket: row.id,
          after: previous,
          attemptId,
        });
        setRecovery({ ticketId: row.id, session });
      }
    } catch (reason) {
      if (!check && !isDefiniteGateLaunchRefusal(reason)) setRecovery({ ticketId: row.id, attemptId });
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
          {check ? "Check review launch" : reviewLabel}
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
