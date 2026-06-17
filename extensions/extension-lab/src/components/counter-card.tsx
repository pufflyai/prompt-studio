import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { type CounterCommandId, executeCounterCommand, getCounterFromCommandEvent } from "../data/counter-api";
import { useLabStore } from "../data/lab-store";
import { useLabHost, useLabHostProps } from "../hooks/host-context";
import { LabCard } from "./lab-card";

export const CounterCard = () => {
  const { host } = useLabHost();
  const { lastCommand, projectId } = useLabHostProps();
  const counter = useLabStore((state) => state.counter);
  const setCounter = useLabStore((state) => state.setCounter);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    void (async () => {
      try {
        const next = await executeCounterCommand({ host, commandId: "extension-lab.counter.read" });
        if (!cancelled) setCounter(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [host, projectId, setCounter]);

  useEffect(() => {
    const next = getCounterFromCommandEvent(lastCommand);
    if (next !== undefined) setCounter(next);
  }, [lastCommand, setCounter]);

  const runCounterCommand = async (commandId: CounterCommandId, params?: Record<string, unknown>) => {
    if (isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const next = await executeCounterCommand({ host, commandId, params });
      setCounter(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <LabCard title="Counter" subtitle="Project-scoped extension storage through ctx.storage.">
      <Stack gap="md">
        <HStack justify="space-between" align="center" wrap="wrap" gap="md">
          <Text textStyle="heading/2XL/bold" fontVariantNumeric="tabular-nums">
            {counter}
          </Text>
          <HStack gap="xs" wrap="wrap">
            <Button
              type="button"
              variant="outline"
              onClick={() => runCounterCommand("extension-lab.counter.bump", { amount: -1 })}
              aria-label="Decrement"
              disabled={isPending}
            >
              -
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => runCounterCommand("extension-lab.counter.bump")}
              aria-label="Increment"
              disabled={isPending}
            >
              +1
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => runCounterCommand("extension-lab.counter.reset")}
              disabled={isPending}
            >
              Reset
            </Button>
          </HStack>
        </HStack>
        {error ? (
          <Text textStyle="paragraph/S/regular" color="fg.error">
            {error}
          </Text>
        ) : null}
      </Stack>
    </LabCard>
  );
};
