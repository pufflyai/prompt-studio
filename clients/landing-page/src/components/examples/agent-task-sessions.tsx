import { HStack, Stack, Text } from "@chakra-ui/react";
import { SessionIndicator } from "@pstdio/ui";
import { type AgentBoardTask, reviewAgent, stageReached } from "../../content/agent-board-content";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";

const STATUS_LABELS = { queued: "Queued", in_progress: "Running", completed: "Done", disconnected: "Paused" };

export const AgentTaskSessions = (props: { task: AgentBoardTask; playing: boolean }) => {
  const { task, playing } = props;
  const styles = useToolDemoStyles();
  const completed = stageReached(task.stage, "finished");
  let status: "queued" | "completed" | "in_progress" | "disconnected" = playing ? "in_progress" : "disconnected";
  if (task.stage === "queued") status = "queued";
  if (completed) status = "completed";
  const reviewStarted = stageReached(task.stage, "reviewing");
  let reviewStatus: typeof status = "queued";
  if (reviewStarted) reviewStatus = playing ? "in_progress" : "disconnected";
  if (task.stage === "ready") reviewStatus = "completed";
  return (
    <Stack gap="xs" width="full" aria-label={`Sessions for ${task.id}`}>
      <HStack css={styles.sessionStatus} data-status={status}>
        <SessionIndicator status={status} boxSize="icon-sm" />
        <Text textStyle="label/XS/regular">{task.agent} · Build</Text>
        <Text textStyle="label/XS/regular" color="fg.muted">
          {STATUS_LABELS[status]}
        </Text>
      </HStack>
      {stageReached(task.stage, "hook") && (
        <HStack css={styles.sessionStatus} data-status={reviewStatus}>
          <SessionIndicator status={reviewStatus} boxSize="icon-sm" />
          <Text textStyle="label/XS/regular">{reviewAgent(task)} · Review</Text>
        </HStack>
      )}
    </Stack>
  );
};
