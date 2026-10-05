import type { WorkbenchExtensionKanbanRendererRecord } from "pstdio-api-contracts";
import type { KanbanRendererCreateSubmission, KanbanRendererViewsProvider, ResourceRef } from "../../core";
import type { ReactAttributeDescriptor as AttributeDescriptor } from "../../react/renderers/kanban/kanban-presentation";
import type { KanbanRendererRow, Localizer, RowAction } from "./kanban-renderer-contribution-helpers";

/** How a host changes the way extension boards load views, resolve resources, and react to changes. */
export interface WorkbenchExtensionKanbanRendererAdapter {
  createViewsProvider?: (record: WorkbenchExtensionKanbanRendererRecord) => KanbanRendererViewsProvider;
  /** Override label resolution. Defaults to workbench's `text(value, fallback)`. */
  resolveLabel?: Localizer;
  /** Post-process an attribute descriptor (after localization). Defaults to identity. */
  decorateAttribute?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    attribute: AttributeDescriptor,
  ) => AttributeDescriptor;
  /**
   * Translate a row's transport-shaped resource (`{ type, id }`) into a workbench
   * `ResourceRef`. Defaults to the workbench `pstdio://extension-resource/...`
   * scheme — dashboard supplies its own. Returns `undefined` for rows that do not
   * carry an explicit resource.
   */
  resolveRowResource?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined;
  /**
   * Synthesize a `ResourceRef` for row-action execution context when the row does
   * not carry an explicit resource. Defaults to a `pstdio://extension-resource/`
   * fallback built from `record.resourceKind` and `row.id`.
   */
  resolveRowActionResource?: (
    record: WorkbenchExtensionKanbanRendererRecord,
    row: KanbanRendererRow,
  ) => ResourceRef | undefined;
  /**
   * Override the row-action runner. `runDefault` performs the workbench's standard
   * flow (look up the row-action command, request params if needed, execute it).
   */
  executeRowAction?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    action: RowAction;
    row: KanbanRendererRow;
    resource: ResourceRef | undefined;
    runDefault: () => Promise<void>;
  }) => void | Promise<void>;
  /**
   * Handle a row click when the renderer has no declared activation handler.
   */
  onRowClick?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    row: KanbanRendererRow;
    resource: ResourceRef | undefined;
  }) => void;
  /** Called after a successful renderer-owned create form submission. */
  onAfterCreate?: (input: {
    record: WorkbenchExtensionKanbanRendererRecord;
    created: unknown;
    submission: KanbanRendererCreateSubmission;
  }) => void | Promise<void>;
  /**
   * Called after any mutation (attribute change, reorder, column action, default
   * create) resolves successfully. Hosts that drive refresh via the outer command
   * pipeline (testbench / workbench) leave this unset; dashboard supplies
   * `ctx.views.refreshView(id)`.
   */
  onAfterMutation?: (record: WorkbenchExtensionKanbanRendererRecord) => void;
}
