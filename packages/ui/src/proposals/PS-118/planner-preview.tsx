import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { LayoutGrid, List, MessageSquare } from "lucide-react";
import { useState } from "react";
import { KanbanRendererBoard } from "@/components/kanban-renderer/kanban-renderer-board";
import { KanbanRendererList } from "@/components/kanban-renderer/kanban-renderer-list";

interface PlannerPreviewProps {
  openCount: number;
  onOpen: () => void;
}

export function PlannerPreview({ openCount, onOpen }: PlannerPreviewProps) {
  const [mode, setMode] = useState<"board" | "list">("board");
  const title = "Review ticket changes with an agent";
  const customSlots = [
    <Badge key="comments" variant="chip" aria-label={`${openCount} open comments`}>
      <MessageSquare />
      {openCount}
    </Badge>,
  ];
  return (
    <Stack h="full" minH="0" gap="0" bg="bg" color="fg">
      <HStack p="sm" justify="space-between" borderBottomWidth="1px" borderColor="border.subtle">
        <Text textStyle="label/M/medium">Planner</Text>
        <HStack gap="xs">
          <Button size="xs" variant={mode === "board" ? "subtle" : "ghost"} onClick={() => setMode("board")}>
            <LayoutGrid />
            Board
          </Button>
          <Button size="xs" variant={mode === "list" ? "subtle" : "ghost"} onClick={() => setMode("list")}>
            <List />
            List
          </Button>
          <Button size="xs" variant="primary" onClick={onOpen}>
            Open PS-118
          </Button>
        </HStack>
      </HStack>
      <Box flex="1" minH="0">
        {mode === "board" ? (
          <KanbanRendererBoard
            columns={[
              {
                id: "backlog",
                label: "Backlog",
                canCreate: false,
                actions: [],
                items: [{ id: "PS-118", cardProps: { eyebrow: "PS-118", title, customSlots, onClick: onOpen } }],
              },
            ]}
          />
        ) : (
          <KanbanRendererList items={[{ id: "PS-118", eyebrow: "PS-118", title, customSlots }]} onItemClick={onOpen} />
        )}
      </Box>
    </Stack>
  );
}
