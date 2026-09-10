import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { ArrowDown, Check, CircleDashed, Play } from "lucide-react";
import { type AgentBoardTask, reviewAgent, STAGE_LABELS, stageReached } from "../../content/agent-board-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useStoryStyles } from "../../hooks/use-landing-styles";
import { BlockSymbol } from "../sections/building-blocks";
import { AgentTaskSessions } from "./agent-task-sessions";
import { DemoPanel } from "./demo-workbench";

interface AgentSessionDetailProps {
  task: AgentBoardTask;
  playing: boolean;
  highlighted?: ToolShapeKind;
  onStart: () => void;
  onFinish: () => void;
}

export const AgentSessionDetail = (props: AgentSessionDetailProps) => {
  const { task, playing, highlighted, onStart, onFinish } = props;
  const styles = useStoryStyles();
  const triggered = stageReached(task.stage, "hook");
  return (
    <Box css={styles.panels}>
      <DemoPanel title={`${task.id} · Agent sessions`} kind="command" highlighted={highlighted}>
        <Text textStyle="label/M/medium">{task.title}</Text>
        <AgentTaskSessions task={task} playing={playing} />
        <Text role="status" textStyle="paragraph/S/regular" color="fg.muted">
          {STAGE_LABELS[task.stage]}
        </Text>
        {(task.stage === "queued" || task.stage === "ready") && (
          <Button variant="subtle" alignSelf="start" onClick={onStart}>
            <Play />
            Start session
          </Button>
        )}
        {(task.stage === "coding" || task.stage === "saving") && (
          <Button variant="subtle" alignSelf="start" onClick={onFinish}>
            <Check />
            Complete session
          </Button>
        )}
      </DemoPanel>
      <DemoPanel title="When a session completes" kind="hook" highlighted={highlighted}>
        <HStack gap="sm">
          <BlockSymbol kind="hook" />
          <Text textStyle="mono/XS">session.completed</Text>
          <Text textStyle="label/S/regular" color={triggered ? "fg.success" : "fg.muted"}>
            {triggered ? "Triggered" : "Listening"}
          </Text>
        </HStack>
        <ArrowDown size={16} />
        <Stack gap="md" aria-label="Hook actions">
          <HStack gap="sm">
            {triggered ? <Check size={16} /> : <CircleDashed size={16} />}
            <Text textStyle="paragraph/S/regular">Move {task.id} to Ready for review</Text>
          </HStack>
          <HStack gap="sm">
            {stageReached(task.stage, "reviewing") ? <Check size={16} /> : <CircleDashed size={16} />}
            <Text textStyle="paragraph/S/regular">Start a {reviewAgent(task)} review session</Text>
          </HStack>
        </Stack>
      </DemoPanel>
    </Box>
  );
};
