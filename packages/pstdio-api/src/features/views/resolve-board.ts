import { z } from "@hono/zod-openapi";
import { type BoardField, extensionKanbanRendererRecordSchema } from "pstdio-api-contracts";
import type { KanbanRendererSettings } from "pstdio-api-contracts/extension-kernel";
import { createWorkbenchExtensionMetadata, text } from "pstdio-extensions/workbench";
import type { RouteDeps } from "../deps";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { executeProjectExtensionCommand } from "../extensions/execute-project-extension-command";
import { resolveEnabledSourceForRecord } from "../extensions/project-extension-runtime-snapshot";
import { BoardViewError } from "./view-rules";

export type BoardViewsDeps = ExtensionsRouteDeps & Pick<RouteDeps, "boardViewsService">;
export const defaultBoardSettings: KanbanRendererSettings = {
  viewMode: "board",
  columnGrouping: "none",
  rowGrouping: "none",
  ordering: { attributeId: "manual", direction: "asc" },
  displayProperties: [],
};
export const getBoards = async (deps: BoardViewsDeps, projectId: string) => {
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  const metadata = createWorkbenchExtensionMetadata({ runtime: snapshot.runtime });
  return metadata.views.flatMap((view) => {
    if (view.body.kind !== "kanban") return [];
    const record = snapshot.runtime.views.find((record) => record.id === view.id)!;
    const source = resolveEnabledSourceForRecord(record.sourcePath, snapshot.enabledSources);
    if (!source) return [];
    const body = view.body;
    const statuses = body.attributes?.filter((field) => field.type.kind === "status") ?? [];
    const settings = {
      ...defaultBoardSettings,
      ...(statuses.length === 1 ? { columnGrouping: statuses[0].id } : {}),
      ...body.defaultSettings,
    };
    const builtIns = (
      body.defaultViews?.length
        ? body.defaultViews
        : [{ id: "default", title: "All", settings, filters: body.defaultFilters ?? {} }]
    ).map((saved) => ({ ...saved, title: text(saved.title, saved.id), boardId: view.id, builtIn: true }));
    return [
      {
        id: view.id,
        title: text(view.title, view.localId),
        extensionId: view.extensionId,
        body,
        settings,
        builtIns,
        statuses: metadata.statuses,
        scope: { project_id: projectId, extension_instance_id: source.instance.id, board_id: view.localId },
      },
    ];
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
const statusesSchema = z.object({ statuses: z.array(z.object({ id: z.string(), label: z.string() })) });
export const resolveBoardFields = async (deps: BoardViewsDeps, board: ResolvedBoard) => {
  const result = await runQuery(deps, board, board.body.queryHandlerId, {
    renderer: { rendererId: board.id, projectId: board.scope.project_id, invocation: { placement: "visible" } },
    settings: board.settings,
    filters: {},
  });
  const rawAttributes = result && typeof result === "object" && "attributes" in result ? result.attributes : undefined;
  const attributes =
    rawAttributes === undefined
      ? (board.body.attributes ?? [])
      : (extensionKanbanRendererRecordSchema.shape.attributes.parse(rawAttributes) ?? []);
  return Promise.all(
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
        filterable: attribute.filterable ?? false,
        groupable: attribute.groupable ?? false,
        sortable: attribute.sortable ?? false,
        displayable: attribute.displayable ?? false,
        ...(options ? { options } : {}),
      } satisfies BoardField;
    }),
  );
};
