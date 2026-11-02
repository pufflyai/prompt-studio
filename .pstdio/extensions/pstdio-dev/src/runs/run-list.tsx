import { Box, HStack, IconButton, Progress, Stack, Text } from "@chakra-ui/react";
import { EmptyState, SimpleCard, Tooltip } from "@pstdio/ui";
import {
  CircleCheck,
  CircleDashed,
  CircleSlash,
  CircleX,
  Github,
  LoaderCircle,
  type LucideIcon,
  Square,
} from "lucide-react";
import type { RunStatus } from "../benchmarks/github";
import { PLATFORMS, platformLabel } from "../benchmarks/platforms";
import type { RunRecord } from "../benchmarks/store";
import { CopySha } from "../webview/copy-sha";

interface RunListProps {
  runs: RunRecord[];
  cancelling?: string;
  onCancel: (runId: string) => void;
  onOpen: (url: string) => void;
}

const STATUS: Record<RunStatus, { label: string; color: string; icon: LucideIcon }> = {
  queued: { label: "Queued", color: "fg.muted", icon: CircleDashed },
  running: { label: "Running", color: "fg.info", icon: LoaderCircle },
  succeeded: { label: "Finished", color: "fg.success", icon: CircleCheck },
  failed: { label: "Failed", color: "fg.error", icon: CircleX },
  cancelled: { label: "Cancelled", color: "fg.muted", icon: CircleSlash },
};

const when = (value: string) =>
  new Date(value).toLocaleString("en-GB", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

const elapsed = (since: string) => {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(since)) / 60_000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
};

const platformsText = (platforms: string[]) =>
  platforms.length === PLATFORMS.length ? "All platforms" : platforms.map(platformLabel).join(", ");

// One line per run: status, commits, platforms, and time. Details live in the status tooltip and on GitHub.
export const RunList = (props: RunListProps) => {
  const { runs, cancelling, onCancel, onOpen } = props;
  if (!runs.length)
    return <EmptyState title="No benchmark runs yet" description="Start a run to measure commits on GitHub Actions." />;
  return (
    <SimpleCard>
      {runs.map((run, index) => {
        const status = STATUS[run.status];
        const Icon = status.icon;
        const active = run.status === "queued" || run.status === "running";
        const tooltip = [
          active ? `${status.label} for ${elapsed(run.createdAt)}` : status.label,
          run.detail,
          run.failure,
          run.syncError,
        ]
          .filter(Boolean)
          .join("\n");
        return (
          <Stack
            key={run.id}
            gap="2xs"
            px="md"
            py="xs"
            borderTopWidth={index ? "1px" : "0"}
            borderColor="border.subtle"
          >
            <HStack gap="sm" minH="7">
              <Tooltip content={tooltip} contentProps={{ whiteSpace: "pre-line" }}>
                <Box
                  as="span"
                  tabIndex={0}
                  color={status.color}
                  flexShrink={0}
                  display="inline-flex"
                  aria-label={tooltip}
                  animation={run.status === "running" ? "spin 1.2s linear infinite" : undefined}
                >
                  <Icon size={16} />
                </Box>
              </Tooltip>
              <HStack gap="xs" flex="1" minW="0" wrap="wrap">
                {run.commits.map((commit) => (
                  <HStack key={commit.ref} gap="0">
                    {commit.sha ? <CopySha sha={commit.sha} /> : null}
                    {commit.sha?.startsWith(commit.ref) ? null : (
                      <Text textStyle="label/S/regular" color="fg.muted">
                        {commit.ref}
                      </Text>
                    )}
                  </HStack>
                ))}
              </HStack>
              <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0} hideBelow="sm">
                {platformsText(run.platforms)}
              </Text>
              <Text textStyle="label/S/regular" color="fg.muted" flexShrink={0} w="28" textAlign="end">
                {when(run.createdAt)}
              </Text>
              <HStack gap="0" flexShrink={0} w="14" justify="flex-end">
                {active ? (
                  <Tooltip content="Cancel run">
                    <IconButton
                      size="xs"
                      variant="ghost"
                      aria-label={`Cancel run ${run.id}`}
                      loading={cancelling === run.id}
                      onClick={() => onCancel(run.id)}
                    >
                      <Square />
                    </IconButton>
                  </Tooltip>
                ) : null}
                <Tooltip content="Open on GitHub">
                  <IconButton
                    size="xs"
                    variant="ghost"
                    aria-label={`Open run ${run.id} on GitHub`}
                    onClick={() => onOpen(run.url)}
                  >
                    <Github />
                  </IconButton>
                </Tooltip>
              </HStack>
            </HStack>
            {run.status === "running" ? (
              <Progress.Root size="xs" value={Math.round((run.progress ?? 0) * 100)} ps="7" aria-label="Run progress">
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
            ) : null}
          </Stack>
        );
      })}
    </SimpleCard>
  );
};
