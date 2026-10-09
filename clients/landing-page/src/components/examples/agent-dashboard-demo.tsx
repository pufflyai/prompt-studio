import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { KanbanRendererBoard } from "@pstdio/ui/kanban-renderer";
import { Clock3, Plus, RotateCcw } from "lucide-react";
import { AGENT_BOARD_COLUMNS, stageReached, taskColumn } from "../../content/agent-board-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useAgentBoardDemo } from "../../hooks/use-agent-board-demo";
import { DemoContribution, useDemoComposition } from "../../hooks/use-demo-composition";
import { useToolDemoStyles } from "../../hooks/use-landing-styles";
import { AgentSessionDetail } from "./agent-session-detail";
import { AgentTaskSessions } from "./agent-task-sessions";
import { AgentWorkflowExamples } from "./agent-workflow-examples";
import { DemoPanel } from "./demo-workbench";

export const AgentDashboardDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const board = useAgentBoardDemo();
  const composition = useDemoComposition();
  const styles = useToolDemoStyles();
  const columns = AGENT_BOARD_COLUMNS.map((column) => ({
    ...column,
    canDragIn: false,
    canDragOut: false,
    canCreate: false,
    actions: [],
    items: board.tasks
      .filter((task) => taskColumn(task.stage) === column.id)
      .map((task) => ({
        id: task.id,
        cardProps: {
          eyebrow: task.id,
          title: task.title,
          onClick: () => board.select(task.id),
          customSlots: [
            <DemoContribution key="sessions" kind="skill">
              <Box data-demo-part="skill">
                <AgentTaskSessions task={task} playing={board.playing} />
              </Box>
            </DemoContribution>,
            <HStack key="actions" gap="xs" flexWrap="wrap">
              <Button
                variant="ghost"
                size="2xs"
                aria-label={`Open sessions for ${task.id}`}
                data-agent-control="session"
                onClick={() => board.select(task.id)}
              >
                Sessions
              </Button>
              <DemoContribution kind="hook">
                {stageReached(task.stage, "hook") && (
                  <Badge colorPalette="green" data-demo-part="hook">
                    Hook fired
                  </Badge>
                )}
              </DemoContribution>
            </HStack>,
          ],
        },
      })),
  }));
  return (
    <Stack ref={board.hostRef} gap="panel-gap" role="group" aria-label="Coding agent workflow">
      {highlighted === "command" || highlighted === "skill" || highlighted === "automation" ? (
        <AgentWorkflowExamples highlighted={highlighted} />
      ) : (
        <>
          <DemoPanel title="Tool development" kind="page" highlighted={highlighted}>
            <HStack justify="space-between" gap="sm" flexWrap="wrap">
              <Text textStyle="label/M/medium">{board.tasks.length} tickets · Agent sessions</Text>
              {composition ? (
                <DemoContribution kind="command">
                  <Button variant="outline" size="xs" data-demo-part="command">
                    <Plus />
                    Create ticket
                  </Button>
                </DemoContribution>
              ) : null}
              {!composition && !board.active && (
                <Button variant="outline" onClick={board.replay}>
                  <RotateCcw />
                  Replay workflow
                </Button>
              )}
            </HStack>
            {composition && (
              <DemoContribution kind="automation">
                <HStack textStyle="label/XS" color="fg.muted" data-demo-part="automation">
                  <Clock3 size={14} />
                  09:00 · Pick up queued tickets
                </HStack>
              </DemoContribution>
            )}
            {composition && (
              <DemoContribution kind="hook">
                <Badge alignSelf="start" colorPalette="green" data-demo-part="hook">
                  session.completed → Ready for review
                </Badge>
              </DemoContribution>
            )}
            <Box css={styles.agentBoard} role="group" aria-label="Coding agent kanban board">
              <KanbanRendererBoard columns={columns} selectedItemId={board.selectedId} />
            </Box>
          </DemoPanel>
          {!composition && (
            <AgentSessionDetail
              task={board.selected}
              playing={board.playing}
              highlighted={highlighted}
              onStart={board.start}
              onFinish={board.finish}
            />
          )}
        </>
      )}
    </Stack>
  );
};
