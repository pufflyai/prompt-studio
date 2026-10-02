import { z } from "@hono/zod-openapi";
import {
  type BoardField,
  type BoardView,
  dataTableBuiltInViews,
  EMPTY_VIEW_FILTER,
  extensionDataTableRendererRecordSchema,
  extensionKanbanRendererRecordSchema,
  kanbanBuiltInViews,
  legacyOrderingFromSorts,
} from "pstdio-api-contracts";
import {
  type DataTableRendererQueryParams,
  type KanbanRendererQueryParams,
  type Localizable,
  VIEW_FILTER_CONDITIONS,
  type ViewFieldKind,
} from "pstdio-api-contracts/extension-kernel";
import { createWorkbenchExtensionMetadata, text } from "pstdio-extensions/workbench";
import type { RouteDeps } from "../deps";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { resolveEnabledSourceForRecord } from "../extensions/project-extension-runtime-snapshot";
import { BoardViewError } from "./view-rules";

export type BoardViewsDeps = ExtensionsRouteDeps & Pick<RouteDeps, "boardViewsService">;
type DeclaredView = Omit<BoardView, "boardId" | "title" | "builtIn"> & { title: Localizable<string> };

export const getBoards = async (deps: BoardViewsDeps, projectId: string) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const metadata = createWorkbenchExtensionMetadata({ runtime: snapshot.runtime });
  return metadata.views.flatMap((view) => {
    const body = view.body;
    if (body.kind !== "kanban" && body.kind !== "dataTable") return [];
    const record = snapshot.runtime.views.find((record) => record.id === view.id)!;
    const source = resolveEnabledSourceForRecord(record.sourcePath, snapshot.enabledSources);
    if (!source) return [];
    const common = {
      id: view.id,
      title: text(view.title, view.localId),
      extensionId: view.extensionId,
      statuses: metadata.statuses,
      scope: { project_id: projectId, extension_instance_id: source.instance.id, board_id: view.localId },
    };
    const localized = <TSettings>(declared: { settings: TSettings; views: DeclaredView[] }) => ({
      settings: declared.settings,
      builtIns: declared.views.map(({ id, title, settings, filter, sorts }) => ({
        id,
        boardId: view.id,
        title: text(title, id),
        settings,
        filter,
        sorts,
        builtIn: true,
      })),
    });
    const board =
      body.kind === "kanban"
        ? { kind: body.kind, body, ...localized(kanbanBuiltInViews(body)) }
        : { kind: body.kind, body, ...localized(dataTableBuiltInViews(body)) };
    return [{ ...common, ...board }];
  });
};
export type ResolvedBoard = Awaited<ReturnType<typeof getBoards>>[number];
export const requireBoard = async (deps: BoardViewsDeps, projectId: string, boardId: string) => {
  const board = (await getBoards(deps, projectId)).find((board) => board.id === boardId);
  if (!board) throw new BoardViewError("board is not enabled", 404);
  return board;
};
const runQuery = async (
  deps: BoardViewsDeps,
  board: ResolvedBoard,
  commandId: string,
  params: Record<string, unknown>,
) => {
  const result = await executeProjectExtensionCommand(deps, {
    projectId: board.scope.project_id,
    commandId,
    body: { source: "api", params },
  });
  if (result.outcome.status !== "success") throw new BoardViewError("Board fields could not be resolved", 503);
  return result.outcome.value;
};
const rendererOf = (board: ResolvedBoard) => ({
  rendererId: board.id,
  projectId: board.scope.project_id,
  invocation: { placement: "visible" as const },
});
const conditionsOf = (kind: ViewFieldKind) => [...VIEW_FILTER_CONDITIONS[kind]];
// The card title is a field of every board, so views can filter and sort by it.
const titleField: BoardField = {
  id: "title",
  label: "Title",
  kind: "string",
  conditions: conditionsOf("string"),
  filterable: true,
  groupable: false,
  sortable: true,
  displayable: false,
};
const statusesSchema = z.object({ statuses: z.array(z.object({ id: z.string(), label: z.string() })) });
const resolveKanbanFields = async (deps: BoardViewsDeps, board: Extract<ResolvedBoard, { kind: "kanban" }>) => {
  const result = await runQuery(deps, board, board.body.queryHandlerId, {
    renderer: rendererOf(board),
    settings: { ...board.settings, ordering: legacyOrderingFromSorts([]) },
    filter: EMPTY_VIEW_FILTER,
    sorts: [],
    filters: {},
  } satisfies KanbanRendererQueryParams);
  const rawAttributes = result && typeof result === "object" && "attributes" in result ? result.attributes : undefined;
  const attributes =
    rawAttributes === undefined
      ? (board.body.attributes ?? [])
      : (extensionKanbanRendererRecordSchema.shape.attributes.parse(rawAttributes) ?? []);
  const fields = await Promise.all(
    attributes.map(async (attribute) => {
      const kind = attribute.type.kind;
      let options: BoardField["options"];
      if (kind === "enum" || kind === "enum-multi")
        options = attribute.type.options.map((option) => ({
          value: option.value,
          label: text(option.label, option.value),
        }));
      if (attribute.type.kind === "status") {
        const ref = attribute.type.statuses;
        const status = board.statuses.find(
          (status) => status.id === `${ref.extensionId ?? board.extensionId}.status.${ref.id}`,
        );
        if (!status) throw new BoardViewError("Board status provider is unavailable", 503);
        options = statusesSchema
          .parse(await runQuery(deps, board, status.queryHandlerId, {}))
          .statuses.map((status) => ({ value: status.id, label: status.label }));
      }
      return {
        id: attribute.id,
        label: text(attribute.label, attribute.id),
        kind,
        conditions: conditionsOf(kind),
        filterable: attribute.filterable ?? false,
        groupable: attribute.groupable ?? false,
        sortable: attribute.sortable ?? false,
        displayable: attribute.displayable ?? false,
        ...(options ? { options } : {}),
      } satisfies BoardField;
    }),
  );
  return fields.some((field) => field.id === titleField.id) ? fields : [titleField, ...fields];
};
const dataTableResultSchema = z.object({
  rows: z.array(z.object({ values: z.record(z.string(), z.unknown()) })),
  columns: extensionDataTableRendererRecordSchema.shape.columns,
});
type DataTableColumn = NonNullable<z.infer<typeof dataTableResultSchema>["columns"]>[number];
const resolveDataTableFields = async (deps: BoardViewsDeps, board: Extract<ResolvedBoard, { kind: "dataTable" }>) => {
  const result = dataTableResultSchema.parse(
    await runQuery(deps, board, board.body.queryHandlerId, {
      renderer: rendererOf(board),
      filter: EMPTY_VIEW_FILTER,
      sorts: [],
      settings: board.settings,
    } satisfies DataTableRendererQueryParams),
  );
  // The same order the table uses to choose its columns.
  const firstRow = result.rows[0];
  const columns: DataTableColumn[] =
    result.columns ?? board.body.columns ?? (firstRow ? Object.keys(firstRow.values).map((id) => ({ id })) : []);
  return columns.map((column) => {
    const values = result.rows
      .map((row) => row.values[column.id])
      .filter((value) => value !== null && value !== undefined);
    const inferred = values.length > 0 && values.every((value) => typeof value === "number") ? "number" : "string";
    const kind = column.type ?? inferred;
    return {
      id: column.id,
      label: text(column.label, column.id),
      kind,
      conditions: conditionsOf(kind),
      filterable: true,
      groupable: column.groupable ?? false,
      sortable: true,
      displayable: true,
    } satisfies BoardField;
  });
};
export const resolveBoardFields = (deps: BoardViewsDeps, board: ResolvedBoard) =>
  board.kind === "kanban" ? resolveKanbanFields(deps, board) : resolveDataTableFields(deps, board);
