import type { ToolPart } from "../agent-types";
import type { Block, Item, TitleSegment } from "../components/timeline";
import type { ToolRenderer } from "./types";

type TodoItem = {
  content: string;
  status?: string;
  priority?: string;
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

  const content = getStringValue(todo.content);
  if (!content) return null;

  return {
    content,
    status: getStringValue(todo.status) ?? undefined,
    priority: getStringValue(todo.priority) ?? undefined,
  };
};

const parseTodoItems = (value: unknown) => {
  if (!value) return [];

  const listSource = (() => {
    if (Array.isArray(value)) return value;
    const objectValue = getObjectValue(value);
    if (!objectValue || !Array.isArray(objectValue.todos)) return [];
    return objectValue.todos;
  })();

  return listSource.map(parseTodoItem).filter((todo): todo is TodoItem => todo !== null);
};

const formatTodoItem = (todo: TodoItem) => {
  const statusToken = todo.status === "completed" ? "x" : " ";
  const meta = [todo.status, todo.priority].filter((value): value is string => Boolean(value));
  if (meta.length === 0) return `- [${statusToken}] ${todo.content}`;

  return `- [${statusToken}] ${todo.content} (${meta.join(" · ")})`;
};

export const createTodowriteRenderer = (deps: TodowriteRendererDependencies): ToolRenderer => {
  const { buildBaseTitle, buildIndicator, prependErrorBlock } = deps;

  return (invocation) => {
    const inputTodos = parseTodoItems(invocation.state?.input);
    const outputTodos = parseTodoItems(invocation.state?.output);
    const todos = outputTodos.length > 0 ? outputTodos : inputTodos;
    if (todos.length === 0) return null;

    const blocks: Block[] = [
      {
        type: "code",
        language: "markdown",
        code: todos.map(formatTodoItem).join("\n"),
      },
    ];

    const title = buildBaseTitle(invocation, `${todos.length} item${todos.length === 1 ? "" : "s"}`, "Update todos");

    return {
      indicator: buildIndicator(invocation),
      title,
      blocks: prependErrorBlock(invocation, blocks),
    } satisfies Item;
  };
};
