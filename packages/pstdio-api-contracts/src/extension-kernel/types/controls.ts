import type { Localizable } from "../l10n";
import type { CommandRef } from "./commands";
import type { EventRef } from "./events";
import type { JsonValue } from "./json";
import type { RendererContext, ResourceRef } from "./resources";

export type ControlsResourceRef = ResourceRef;

export interface ControlsQueryParams {
  renderer: RendererContext;
}

// Serializable control declarations returned by the query command. `params` and
// `groups` mirror @pstdio/ui ParamEditor's shapes but stay JSON-safe on the wire.
export interface ControlsQueryResult {
  params?: JsonValue[];
  groups?: JsonValue[];
  values?: Record<string, JsonValue>;
  readOnly?: boolean;
}

export interface ControlsUpdateValueInput {
  renderer: RendererContext;
  controlId: string;
  value: JsonValue;
  values: Record<string, JsonValue>;
}

export interface ControlsApplyInput {
  renderer: RendererContext;
  values: Record<string, JsonValue>;
}

export interface ControlsResetInput {
  renderer: RendererContext;
  controlIds?: string[];
}

/**
 * A reusable native control renderer backed by commands, rendered through the host's
 * ParamEditor. The query command loads the control declarations + current values; the
 * optional update/apply/reset commands persist edits (omitting both makes it read-only).
 * A `panel` places the renderer into a panel via `controlsRenderer: "<id>"`, mirroring
 * `treeRenderer`/`fileRenderer` — the panel owns placement (resourceKind, surface, target).
 */
export interface ControlsRendererContribution {
  title: Localizable<string>;
  queryCommand: CommandRef<ControlsQueryParams, ControlsQueryResult> | string;
  updateValueCommand?: CommandRef<ControlsUpdateValueInput, unknown> | string;
  applyCommand?: CommandRef<ControlsApplyInput, unknown> | string;
  resetCommand?: CommandRef<ControlsResetInput, unknown> | string;
  refreshEvents?: EventRef[];
  defaultValues?: Record<string, JsonValue>;
  emptyTitle?: Localizable<string>;
  emptyDescription?: Localizable<string>;
}
