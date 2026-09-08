import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { SessionIndicator } from "@pstdio/ui";
import { FileChangeBadge } from "@pstdio/ui/diff";
import { Check, FileCode2, GitBranch, Pause, Play } from "lucide-react";
import { useState } from "react";
import type { ToolShapeKind } from "../shapes/tool-shapes";
import { BlockSymbol, useStoryStyles } from "./building-blocks";
import { DemoPanel, useToolDemoStyles } from "./demo-workbench";
import { FontSpecimen } from "./font-editor-demo";
import { EXAMPLE_AGENTS } from "./tool-examples-content";

const STATUS_LABELS = {
  in_progress: "Running",
  awaiting_input: "To review",
  completed: "Completed",
  disconnected: "Paused",
  queued: "Queued",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const AgentDashboardDemo = (props: { highlighted?: ToolShapeKind; withPreview?: boolean }) => {
  const { highlighted, withPreview = true } = props;
  const [agents, setAgents] = useState(EXAMPLE_AGENTS);
  const [selected, setSelected] = useState(agents[0].id);
  const agent = agents.find((item) => item.id === selected)!;
  const story = useStoryStyles();
  const styles = useToolDemoStyles();
  const completed = agent.status === "completed";
  const running = agent.status === "in_progress";
  const reviewing = agent.status === "awaiting_input";

  const act = () => {
    let status = "in_progress" as typeof agent.status;
    if (running) status = "disconnected";
    if (reviewing) status = "completed";
    setAgents(agents.map((item) => (item.id === selected ? { ...item, status } : item)));
  };

  let actionLabel = "Resume agent";
  if (running) actionLabel = "Pause agent";
  if (reviewing) actionLabel = "Approve result";
  if (completed) actionLabel = "Approved";

  return (
    <Stack gap="panel-gap">
      <Box css={styles.metrics}>
        {[
          { label: "Running", value: agents.filter((item) => item.status === "in_progress").length },
          { label: "To review", value: agents.filter((item) => item.status === "awaiting_input").length },
          { label: "Completed", value: 16 + agents.filter((item) => item.status === "completed").length },
        ].map((metric) => (
          <Box css={styles.metric} key={metric.label}>
            <Text textStyle="heading/M">{metric.value}</Text>
            <Text textStyle="label/S/regular" color="fg.muted">
              {metric.label}
            </Text>
          </Box>
        ))}
      </Box>
      <Box css={story.panels}>
        <DemoPanel title="Agent sessions" kind="page" highlighted={highlighted}>
          <Box css={styles.sessions} role="group" aria-label="Example agent sessions">
            {agents.map((item) => (
              <Box
                as="button"
                css={styles.session}
                key={item.id}
                aria-pressed={selected === item.id}
                onClick={() => setSelected(item.id)}
              >
                <HStack gap="sm">
                  <BlockSymbol kind={item.kind} />
                  <Text textStyle="label/M/medium">{item.title}</Text>
                </HStack>
                <HStack css={styles.toolbar}>
                  <Text textStyle="label/S/regular" color="fg.muted">
                    {item.agent}
                  </Text>
                  <HStack gap="xs">
                    <SessionIndicator status={item.status} boxSize="icon-sm" />
                    <Text textStyle="label/S/regular">{STATUS_LABELS[item.status]}</Text>
                  </HStack>
                </HStack>
                <Box css={styles.progress} aria-hidden="true">
                  {Array.from({ length: 16 }, (_, i) => (
                    <Box key={i} css={styles.segment} data-filled={i < item.progress} data-status={item.status} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
          <HStack gap="sm" mt="auto" pt="sm" color="fg.muted">
            <BlockSymbol kind="automation" />
            <Text textStyle="label/S/regular">Glyph check · Every day at 9:00</Text>
          </HStack>
        </DemoPanel>
        <DemoPanel title={agent.title} kind="command" highlighted={highlighted}>
          <HStack gap="xs" color="fg.muted" textStyle="mono/XS">
            <Icon as={GitBranch} boxSize="icon-sm" />
            <Text>workbench / fonts</Text>
          </HStack>
          {withPreview ? (
            <Box css={styles.preview}>
              <HStack css={styles.toolbar}>
                <HStack gap="xs">
                  <BlockSymbol kind="hook" />
                  <Text textStyle="label/S/regular">App preview</Text>
                </HStack>
                <Text textStyle="label/S/regular" color="fg.muted">
                  {agent.files.length} files changed
                </Text>
              </HStack>
              <FontSpecimen alphabet={agent.id === "coverage"} weight={agent.id === "specimen" ? 700 : 500} />
            </Box>
          ) : (
            <Box css={styles.preview}>
              {agent.files.map((file) => (
                <Box css={styles.file} key={file.name}>
                  <Icon as={FileCode2} boxSize="icon-sm" color="fg.muted" />
                  <Text truncate flex="1">
                    {file.name}
                  </Text>
                  <Text color="fg.success">+{file.added}</Text>
                  <Text color="fg.error">−{file.removed}</Text>
                  <FileChangeBadge change="modified" />
                </Box>
              ))}
            </Box>
          )}
          <Box css={styles.checks}>
            {["Outline checks", "Font compiled"].map((label) => (
              <HStack key={label} gap="xs">
                <Icon as={Check} boxSize="icon-sm" />
                <Text>{label}</Text>
              </HStack>
            ))}
          </Box>
          <HStack css={styles.toolbar}>
            <HStack aria-live="polite" gap="xs">
              <SessionIndicator status={agent.status} boxSize="icon-sm" />
              <Text textStyle="label/S/regular">{STATUS_LABELS[agent.status]}</Text>
            </HStack>
            <Button variant="outline" onClick={act} disabled={completed}>
              {running ? <Pause /> : <Play />}
              {actionLabel}
            </Button>
          </HStack>
        </DemoPanel>
      </Box>
    </Stack>
  );
};
