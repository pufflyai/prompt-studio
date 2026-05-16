import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { executeCounterCommand } from "../counter-api";
import { useLabHost, useLabHostProps } from "../host-context";
import { useLabStore } from "../store/lab-store";
import { LabCard } from "./lab-card";

// Only mutation commands trigger a refetch — including `extension-lab.counter.read` here would
// loop forever, because every read publishes a new event that retriggers this effect.
const COUNTER_MUTATION_IDS = new Set(["extension-lab.counter.bump", "extension-lab.counter.reset"]);

export const CounterCard = () => {
  const { host } = useLabHost();
  const { lastCommand, projectId } = useLabHostProps();
  const counter = useLabStore((state) => state.counter);
  const setCounter = useLabStore((state) => state.setCounter);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compute a stable "mutation tick" — only counter mutations advance it. Non-mutations
  // (including the `extension-lab.counter.read` calls this effect itself fires) leave it alone, so
  // the effect does NOT re-run on every host command. Without this, every read event
  // would re-trigger the effect, cancelling its own in-flight fetch.
  const mutationTick = lastCommand && COUNTER_MUTATION_IDS.has(lastCommand.commandId) ? lastCommand.tick : null;

  // Initial fetch on mount + refetch on each new counter mutation event.
  // biome-ignore lint/correctness/useExhaustiveDependencies: depending on mutationTick (not full lastCommand) on purpose — read events should not retrigger this effect.
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
  }, [host, projectId, setCounter, mutationTick]);

  const runCounterCommand = async (
    commandId: "extension-lab.counter.bump" | "extension-lab.counter.read" | "extension-lab.counter.reset",
    params?: Record<string, unknown>,
  ) => {
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
              variant="solid"
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
