import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { KanbanRendererBoard } from "@pstdio/ui/kanban-renderer";
import { Bot } from "lucide-react";
import { useState } from "react";
import { AGENT_BOARD_COLUMNS, AGENT_BOARD_TASKS } from "../../content/agent-board-content";
import type { ToolShapeKind } from "../../content/tool-shapes";
import { DemoPanel } from "./demo-workbench";

export const AgentDashboardDemo = (props: { highlighted?: ToolShapeKind }) => {
  const { highlighted } = props;
  const [tasks, setTasks] = useState(AGENT_BOARD_TASKS);
  const columns = AGENT_BOARD_COLUMNS.map((column) => ({
    ...column,
    canDragIn: true,
    canDragOut: true,
    canCreate: false,
    actions: [],
    items: tasks
      .filter((task) => task.column === column.id)
      .map((task) => ({
        id: task.id,
        cardProps: {
          eyebrow: task.id,
          title: task.title,
          customSlots: [
            <Badge key="agent" variant="subtle">
              <Bot />
              {task.agent}
            </Badge>,
          ],
        },
      })),
  }));

  return (
    <DemoPanel title="Tool development" kind="page" highlighted={highlighted}>
      <HStack justify="space-between" gap="sm" flexWrap="wrap">
        <Text textStyle="label/M/medium">6 tasks · 3 agents</Text>
        <Text textStyle="label/S/regular" color="fg.muted">
          Drag a task to update its status
        </Text>
      </HStack>
      <Box height="96" minWidth="0" role="group" aria-label="Coding agent kanban board">
        <KanbanRendererBoard
          columns={columns}
          onMoveItem={(id, column) =>
            setTasks((current) => current.map((task) => (task.id === id ? { ...task, column } : task)))
          }
        />
      </Box>
    </DemoPanel>
  );
};
