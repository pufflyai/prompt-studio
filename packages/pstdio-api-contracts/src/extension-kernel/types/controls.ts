import type { RendererCallback } from "./context";
import type { ControlGroup, ControlParam, ControlValue, ControlValueMap } from "./control-declarations";
import type { RendererContributionBase } from "./renderer-base";
import type { RendererContext, ResourceRef } from "./resources";

export type ControlsResourceRef = ResourceRef;

export interface ControlsQueryParams {
  renderer: RendererContext;
}

// Serializable control declarations returned by the query command. `params` and
// `groups` mirror @pstdio/ui ParamEditor's shapes but stay JSON-safe on the wire.
export interface ControlsQueryResult {
  params?: ControlParam[];
  groups?: ControlGroup[];
  values?: ControlValueMap;
  readOnly?: boolean;
}

export interface ControlsUpdateValueInput {
  renderer: RendererContext;
  controlId: string;
  value: ControlValue;
  values: ControlValueMap;
}

export interface ControlsApplyInput {
  renderer: RendererContext;
  values: ControlValueMap;
}

export interface ControlsResetInput {
  renderer: RendererContext;
  controlIds?: string[];
}

/** A native controls view. Its query supplies serializable fields and their current values. */
export interface ControlsRendererContribution extends RendererContributionBase {
  query: RendererCallback<ControlsQueryParams, ControlsQueryResult>;
  onValueChange?: RendererCallback<ControlsUpdateValueInput, unknown>;
  onApply?: RendererCallback<ControlsApplyInput, unknown>;
  onReset?: RendererCallback<ControlsResetInput, unknown>;
  defaultValues?: ControlValueMap;
}
