import type { ReactNode } from "react";

export interface BaseParam {
  id: string;
  name: string;
  description?: string;
}

export interface NumberParam extends BaseParam {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface TextParam extends BaseParam {
  type: "text";
  defaultValue: string;
  singleLine?: boolean;
}

export interface SelectionParam extends BaseParam {
  type: "selection";
  defaultValue: string | string[];
  options: { id: string; name: string; icon?: string }[];
  multiSelect?: boolean;
  placeholder?: string;
}

export interface DateParam extends BaseParam {
  type: "date";
  defaultValue: string;
  min?: string;
  max?: string;
}

export interface ColorParam extends BaseParam {
  type: "color";
  defaultValue: string;
}

export interface PropertyParam extends BaseParam {
  type: "property";
  value: ReactNode;
}

/** Editable numeric control with a slider, unit label, markers, and optional discrete snapping. */
export interface SliderParam extends BaseParam {
  type: "slider";
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  markerCount?: number;
  baseValue?: number;
  variant?: "continuous" | "discrete";
}

export type RangeValue = [number, number];

/** Two-handle numeric range control. Values normalize to ordered `[start, end]`. */
export interface RangeParam extends BaseParam {
  type: "range";
  defaultValue: RangeValue;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  markerCount?: number;
}

export interface SegmentedOption {
  id: string;
  name: string;
  icon?: string;
  indicatorColor?: string;
}

/** Mutually-exclusive mode control rendered as a segmented button group. */
export interface SegmentedParam extends BaseParam {
  type: "segmented";
  defaultValue: string;
  options: SegmentedOption[];
  variant?: "default" | "dots";
}

export interface ActionOption {
  id: string;
  name: string;
  icon?: string;
  disabled?: boolean;
}

/** Compact command set rendered as an action button row. */
export interface ActionsParam extends BaseParam {
  type: "actions";
  defaultValue?: string;
  options: ActionOption[];
}

export type AnchorGridValue =
  | "top-left"
  | "top"
  | "top-right"
  | "left"
  | "center"
  | "right"
  | "bottom-left"
  | "bottom"
  | "bottom-right";

/** Nine-point alignment picker. */
export interface AnchorGridParam extends BaseParam {
  type: "anchorGrid";
  defaultValue: AnchorGridValue;
}

export interface VectorValue {
  x: number;
  y: number;
}

/** Paired x/y numeric control. */
export interface VectorParam extends BaseParam {
  type: "vector";
  defaultValue: VectorValue;
  coordinateMode?: "cartesian" | "screen";
  xLabel?: string;
  yLabel?: string;
  min?: number;
  max?: number;
  step?: number;
}

/** Monospace textarea for short code snippets. */
export interface CodeParam extends BaseParam {
  type: "code";
  defaultValue: string;
  language?: string;
  minRows?: number;
}

/** File selection metadata. Not a live `File` object — hosts own persistence. */
export interface FileDropValue {
  name: string;
  mimeType?: string;
  size?: number;
  dataUrl?: string;
}

export interface FileDropParam extends BaseParam {
  type: "fileDrop";
  defaultValue: FileDropValue | null;
  accept?: string;
  assetKind?: "file" | "image";
}

export interface ColorOpacityValue {
  hex: string;
  opacity: number;
}

/** Color plus an alpha channel (0-100). */
export interface ColorOpacityParam extends BaseParam {
  type: "colorOpacity";
  defaultValue: ColorOpacityValue;
}

export interface InputGroup {
  id: string;
  title: string;
  description?: string;
  params: Param[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type ParamValue =
  | number
  | string
  | null
  | string[]
  | RangeValue
  | VectorValue
  | ColorOpacityValue
  | FileDropValue;

export type Param =
  | NumberParam
  | TextParam
  | SelectionParam
  | DateParam
  | ColorParam
  | PropertyParam
  | SliderParam
  | RangeParam
  | SegmentedParam
  | ActionsParam
  | AnchorGridParam
  | VectorParam
  | CodeParam
  | FileDropParam
  | ColorOpacityParam;

export type ParamValueMap = Record<string, ParamValue>;
