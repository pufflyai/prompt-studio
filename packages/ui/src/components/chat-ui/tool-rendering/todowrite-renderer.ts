import type { ToolPart } from "../components/message-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
import type { ToolRenderer } from "./types";

type TodoItem = {
  label: string;
  checked: boolean;
};

type TodowriteRendererDependencies = {
  buildBaseTitle: (invocation: ToolPart, detail?: string, labelOverride?: string) => TitleSegment[];
  buildIndicator: (invocation: ToolPart) => Item["indicator"];
  prependErrorBlock: (invocation: ToolPart, blocks: Block[]) => Block[];
};

const getStringValue = (value: unknown) => {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return null;
};

const getObjectValue = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseTodoItem = (value: unknown): TodoItem | null => {
  const todo = getObjectValue(value);
  if (!todo) return null;

  const content = getStringValue(todo.content) ?? getStringValue(todo.title);
  if (!content) return null;
  const status = getStringValue(todo.status);

  return {
    label: content,
    checked: status === "completed",
  };
};

const parseTodoItems = (value: unknown) => {
  if (!value) return { items: [], explicit: false };

  const listSource = (() => {
    if (Array.isArray(value)) return value;
    const objectValue = getObjectValue(value);
    if (!objectValue || !Array.isArray(objectValue.todos)) return null;
    return objectValue.todos;
  })();

  if (!listSource) return { items: [], explicit: false };

  return {
    items: listSource.map(parseTodoItem).filter((todo): todo is TodoItem => todo !== null),
    explicit: true,
  };
};

export const createTodowriteRenderer = (deps: TodowriteRendererDependencies): ToolRenderer => {
  const { buildBaseTitle, buildIndicator, prependErrorBlock } = deps;

  return (invocation) => {
    const inputTodos = parseTodoItems(invocation.state?.input);
    const outputTodos = parseTodoItems(invocation.state?.output);
    const todoState = outputTodos.explicit ? outputTodos : inputTodos;
    if (!todoState.explicit) return null;

    const todos = todoState.items;
    const countLabel = `${todos.length} item${todos.length === 1 ? "" : "s"}`;
    const title = buildBaseTitle(invocation, countLabel, "Update todos");

    if (todos.length === 0) {
      return {
        indicator: buildIndicator(invocation),
        title,
        blocks: prependErrorBlock(invocation, [{ type: "comment", text: "No todos" }]),
      } satisfies Item;
    }

    const blocks: Block[] = [
      {
        type: "todo-list",
        items: todos,
      },
    ];

    return {
      indicator: buildIndicator(invocation),
      title,
      blocks: prependErrorBlock(invocation, blocks),
    } satisfies Item;
  };
};
