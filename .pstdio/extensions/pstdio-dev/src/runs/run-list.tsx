import { Box, Button, HStack, Progress, Stack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard } from "@pstdio/ui";
import type { RunStatus } from "../benchmarks/github";
import type { RunRecord } from "../benchmarks/store";

interface RunListProps {
  runs: RunRecord[];
  cancelling?: string;
  onCancel: (runId: string) => void;
  onOpen: (url: string) => void;
}

const STATUS: Record<RunStatus, { label: string; color: string }> = {
  queued: { label: "Queued", color: "fg.muted" },
  running: { label: "Running", color: "fg.info" },
  succeeded: { label: "Finished", color: "fg.success" },
  failed: { label: "Failed", color: "fg.error" },
  cancelled: { label: "Cancelled", color: "fg.muted" },
};

const when = (value: string) =>
  new Date(value).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export const RunList = (props: RunListProps) => {
  const { runs, cancelling, onCancel, onOpen } = props;
  if (!runs.length)
    return <EmptyState title="No benchmark runs yet" description="Start a run to measure commits on GitHub Actions." />;
  return (
    <SimpleCard>
      {runs.map((run, index) => {
        const status = STATUS[run.status];
        const active = run.status === "queued" || run.status === "running";
        return (
          <HStack
            key={run.id}
            gap="lg"
            px="md"
            py="sm"
            wrap="wrap"
            borderTopWidth={index ? "1px" : "0"}
            borderColor="border.subtle"
          >
            <HStack gap="xs" w="24" flexShrink={0} color={status.color} textStyle="label/S/medium">
              <Box boxSize="2" borderRadius="full" bg="currentColor" />
              <Text>{status.label}</Text>
            </HStack>
            <Stack gap="2xs" flex="1 1 18rem" minW="0">
              <HStack gap="sm" align="baseline">
                <Text textStyle="label/S/medium">Run {run.id}</Text>
                <Text textStyle="label/S/regular" color="fg.muted" truncate>
                  {run.title}
                </Text>
              </HStack>
              {run.status === "running" ? (
                <Progress.Root
                  size="xs"
                  value={Math.round((run.progress ?? 0) * 100)}
                  maxW="sm"
                  aria-label="Run progress"
                >
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              ) : null}
              {run.failure ? (
                <Text textStyle="mono/XS" color="fg.error">
                  {run.failure}
                </Text>
              ) : null}
            </Stack>
            <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0}>
              {when(run.createdAt)}
            </Text>
            <HStack gap="xs" flexShrink={0}>
              {active ? (
                <Button size="xs" variant="outline" loading={cancelling === run.id} onClick={() => onCancel(run.id)}>
                  Cancel
                </Button>
              ) : null}
              <Button size="xs" variant="ghost" onClick={() => onOpen(run.url)}>
                Open on GitHub
              </Button>
            </HStack>
          </HStack>
        );
      })}
    </SimpleCard>
  );
};
