import type { Block, Item } from "../../components/timeline";
import { buildBaseTitle, buildIndicator, getInputObject, prependErrorBlock } from "../renderer-utils";
import type { ToolRenderer } from "../types";

type TodoItem = {
  id?: string;
  content?: string;
  status?: string;
  priority?: string;
};

const STATUS_ICONS: Record<string, string> = {
  completed: "\u2705",
  in_progress: "\u23f3",
  pending: "\u25cb",
};

const formatTodo = (todo: TodoItem) => {
  const icon = STATUS_ICONS[todo.status ?? ""] ?? "\u25cb";
  return `${icon} ${todo.content ?? "Untitled"}`;
};

export const renderTodoWrite: ToolRenderer = (invocation) => {
  const input = getInputObject(invocation);
  const todos = Array.isArray(input?.todos) ? (input.todos as TodoItem[]) : [];

  const title = buildBaseTitle(invocation, undefined, "Update tasks");
  const blocks: Block[] = [];

  if (todos.length > 0) {
    const text = todos.map(formatTodo).join("\n");
    blocks.push({ type: "text", text });
  }

  return {
    indicator: buildIndicator(invocation),
    title,
    blocks: prependErrorBlock(invocation, blocks),
  } satisfies Item;
};
