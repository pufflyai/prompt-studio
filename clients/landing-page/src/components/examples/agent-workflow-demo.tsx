import { Box, Button, HStack, Icon, Stack, Text } from "@chakra-ui/react";
import { SessionIndicator } from "@pstdio/ui";
import { Check, CircleDashed, Pause, Play } from "lucide-react";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { WORKFLOW_ICONS } from "../../content/workflow-demo-content";
import { useStoryStyles, useToolDemoStyles } from "../../hooks/use-landing-styles";
import { useWorkflowDemo } from "../../hooks/use-workflow-demo";
import { BlockSymbol } from "../sections/building-blocks";
import { DemoPanel } from "./demo-workbench";
import { IconSetPreview, type PreviewIconState } from "./icon-set-preview";

const STATUS_LABELS = {
  in_progress: "Running",
  completed: "Completed",
  disconnected: "Paused",
  queued: "Queued",
};

export const AgentWorkflowDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const workflow = useWorkflowDemo();
  const { frame, finished, playing, completed, steps } = workflow;
  const current = steps[frame.stepIndex];
  const story = useStoryStyles();
  const styles = useToolDemoStyles();
  const running = playing && !finished ? 1 : 0;
  const iconsPerAction = Math.ceil(WORKFLOW_ICONS.length / current.actions.length);
  const activeStart = frame.actionIndex * iconsPerAction;
  const activeEnd = activeStart + iconsPerAction;
  const icons = WORKFLOW_ICONS.map((item, index) => {
    let state: PreviewIconState = "ready";
    if (!finished && index >= activeStart && index < activeEnd) state = "active";
    if (frame.stepIndex === 0 && index >= activeEnd) state = "pending";
    return { ...item, state };
  });
  const checks = [
    { label: "SVG checks", passed: finished || (frame.stepIndex === 2 && frame.actionIndex >= 2) },
    { label: "Codepoints verified", passed: finished || (frame.stepIndex === 2 && frame.actionIndex >= 3) },
  ];

  return (
    <Stack ref={workflow.hostRef} gap="panel-gap" role="group" aria-label="Icon set workflow">
      <Box css={styles.metrics}>
        {[
          { label: "Running", value: running },
          { label: "Queued", value: steps.filter((step) => step.status === "queued").length },
          { label: "Completed", value: completed },
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
          <Box css={styles.sessions} as="ol" aria-label="Workflow steps">
            {steps.map((step) => (
              <Box as="li" css={styles.session} key={step.id} data-status={step.status}>
                <HStack gap="sm">
                  <BlockSymbol kind={step.kind} />
                  <Text textStyle="label/M/medium">{step.title}</Text>
                </HStack>
                <HStack css={styles.toolbar}>
                  <Text textStyle="label/S/regular" color="fg.muted">
                    {step.agent}
                  </Text>
                  <HStack css={styles.sessionStatus} data-status={step.status}>
                    <SessionIndicator status={step.status} boxSize="icon-sm" />
                    <Text textStyle="label/S/regular">{STATUS_LABELS[step.status]}</Text>
                  </HStack>
                </HStack>
              </Box>
            ))}
          </Box>
          <HStack gap="sm" mt="auto" pt="sm" color="fg.muted">
            <BlockSymbol kind="automation" />
            <Text textStyle="label/S/regular">Summarize agent runs · Weekdays at 9:00</Text>
          </HStack>
        </DemoPanel>
        <DemoPanel title={finished ? "Icon set ready" : current.title} kind="command" highlighted={highlighted}>
          <HStack css={styles.toolbar}>
            <Text textStyle="label/S/regular" color="fg.muted" role="status">
              {finished ? "Workflow complete. Your icons are ready to use." : frame.action}
            </Text>
            <Button variant="outline" onClick={workflow.toggle}>
              {playing ? <Pause /> : <Play />}
              {playing ? "Pause workflow" : "Start workflow"}
            </Button>
          </HStack>
          <Box css={styles.preview}>
            <IconSetPreview icons={icons} />
          </Box>
          <Box css={styles.checks}>
            {checks.map((check) => (
              <HStack key={check.label} gap="xs" color={check.passed ? "fg.success" : "fg.muted"}>
                <Icon as={check.passed ? Check : CircleDashed} boxSize="icon-sm" />
                <Text>{check.label}</Text>
              </HStack>
            ))}
          </Box>
        </DemoPanel>
      </Box>
    </Stack>
  );
};
