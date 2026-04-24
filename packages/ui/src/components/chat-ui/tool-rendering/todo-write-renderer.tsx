import { Badge, Box, HStack, Stack, Text } from "@chakra-ui/react";
import { buildBaseTitle, buildIndicator, getInputObject, getOutputObject, prependErrorBlock } from "./shared";
import type { ToolRenderer } from "./types";

type TodoItem = {
  content: string;
  status?: string;
  priority?: string;
};

const getTodos = (invocation: Parameters<ToolRenderer>[0]) => {
  const output = getOutputObject(invocation);
  const input = getInputObject(invocation);
  const candidates = [output?.newTodos, output?.todos, input?.todos];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;

    const todos: TodoItem[] = [];

    for (const item of candidate) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;

      const todo = item as Record<string, unknown>;
      if (typeof todo.content !== "string" || todo.content.trim().length === 0) continue;

      todos.push({
        content: todo.content,
        status: typeof todo.status === "string" ? todo.status : undefined,
        priority: typeof todo.priority === "string" ? todo.priority : undefined,
      });
    }

    if (todos.length > 0) return todos;
  }

  return [] as TodoItem[];
};

const formatBadgeLabel = (value?: string) => value?.replace(/_/g, " ") ?? null;

export const renderTodoWrite: ToolRenderer = (invocation) => {
  const todos = getTodos(invocation);

  return {
    indicator: buildIndicator(invocation),
    title: buildBaseTitle(invocation, undefined, "Update todos"),
    blocks: prependErrorBlock(invocation, [
      {
        type: "component",
        render: () => (
          <Stack gap="sm">
            {todos.map((todo) => {
              const status = formatBadgeLabel(todo.status);
              const priority = formatBadgeLabel(todo.priority);

              return (
                <Box key={`${todo.content}-${todo.status}-${todo.priority}`} borderWidth="1px" borderRadius="md" p="sm">
                  <Stack gap="xs">
                    <Text textStyle="label/M/regular">{todo.content}</Text>
                    <HStack gap="xs" wrap="wrap">
                      {status ? <Badge variant="outline">{status}</Badge> : null}
                      {priority ? <Badge variant="subtle">{priority}</Badge> : null}
                    </HStack>
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        ),
      },
    ]),
  };
};
