import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { executeCounterCommand, getProjectIdFromSearch } from "../counter-api";
import { useLabStore } from "../store/lab-store";
import { LabCard } from "./lab-card";

export const CounterCard = () => {
  const counter = useLabStore((state) => state.counter);
  const setCounter = useLabStore((state) => state.setCounter);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const projectId = getProjectIdFromSearch(window.location.search);

  useEffect(() => {
    if (!projectId) return;

    let isMounted = true;

    const readCounter = async () => {
      setIsPending(true);
      setError(null);

      try {
        const next = await executeCounterCommand({ commandId: "lab.counter.read", projectId });
        if (isMounted) {
          setCounter(next);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) {
          setIsPending(false);
        }
      }
    };

    void readCounter();

    return () => {
      isMounted = false;
    };
  }, [projectId, setCounter]);

  const runCounterCommand = async (
    commandId: "lab.counter.bump" | "lab.counter.read" | "lab.counter.reset",
    params?: Record<string, unknown>,
  ) => {
    if (!projectId || isPending) return;

    setIsPending(true);
    setError(null);

    try {
      const next = await executeCounterCommand({ commandId, projectId, params });
      setCounter(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsPending(false);
    }
  };

  const disabled = isPending || !projectId;

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
              onClick={() => runCounterCommand("lab.counter.bump", { amount: -1 })}
              aria-label="Decrement"
              disabled={disabled}
            >
              -
            </Button>
            <Button
              type="button"
              variant="solid"
              onClick={() => runCounterCommand("lab.counter.bump")}
              aria-label="Increment"
              disabled={disabled}
            >
              +1
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => runCounterCommand("lab.counter.reset")}
              disabled={disabled}
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
