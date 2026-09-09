import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { KanbanRendererBoard } from "@pstdio/ui/kanban-renderer";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AGENT_BOARD_COLUMNS, stageReached, taskColumn } from "../../content/agent-board-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { useAgentBoardDemo } from "../../hooks/use-agent-board-demo";
import { AgentSessionDetail } from "./agent-session-detail";
import { AgentTaskSessions } from "./agent-task-sessions";
import { DemoPanel } from "./demo-workbench";

export const AgentDashboardDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const board = useAgentBoardDemo();
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
            <AgentTaskSessions key="sessions" task={task} playing={board.playing} />,
            <HStack key="actions" gap="xs" flexWrap="wrap">
              <Button
                variant="ghost"
                size="2xs"
                aria-label={`Open sessions for ${task.id}`}
                onClick={() => board.select(task.id)}
              >
                Sessions
              </Button>
              {stageReached(task.stage, "hook") && <Badge colorPalette="green">Hook fired</Badge>}
            </HStack>,
          ],
        },
      })),
  }));
  return (
    <Stack ref={board.hostRef} gap="panel-gap" role="group" aria-label="Coding agent workflow">
      <DemoPanel title="Tool development" kind="page" highlighted={highlighted}>
        <HStack justify="space-between" gap="sm" flexWrap="wrap">
          <Text textStyle="label/M/medium">{board.tasks.length} tasks · Agent sessions</Text>
          {board.active ? (
            <Button variant="outline" onClick={board.toggle}>
              {board.playing ? <Pause /> : <Play />}
              {board.playing ? "Pause workflow" : "Start workflow"}
            </Button>
          ) : (
            <Button variant="outline" onClick={board.replay}>
              <RotateCcw />
              Replay workflow
            </Button>
          )}
        </HStack>
        <Box height="96" minWidth="0" role="group" aria-label="Coding agent kanban board">
          <KanbanRendererBoard columns={columns} selectedItemId={board.selectedId} />
        </Box>
      </DemoPanel>
      <AgentSessionDetail
        task={board.selected}
        playing={board.playing}
        highlighted={highlighted}
        onStart={board.start}
        onFinish={board.finish}
      />
    </Stack>
  );
};
