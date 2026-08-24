import type { ReactNode } from "react";

export interface BaseParam {
  id: string;
  name: string;
  description?: string;
  /** Locks this one param while the rest of the editor stays editable. */
  readOnly?: boolean;
}

export interface NumberParam extends BaseParam {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanParam extends BaseParam {
  type: "boolean";
  defaultValue: boolean;
}

export interface TextParam extends BaseParam {
  type: "text";
  defaultValue: string;
  singleLine?: boolean;
}

export interface MarkdownParam extends BaseParam {
  type: "markdown";
  defaultValue: string;
  placeholder?: string;
}

export interface SelectionOption {
  id: string;
  name: string;
  icon?: string;
  /** Palette key (e.g. "blue") applied to the option's icon. */
  color?: string;
  description?: string;
  disabled?: boolean;
}

/** Parent selector used to swap the option set of a grouped selection. */
export interface SelectionGroup {
  id: string;
  name: string;
  defaultValue: string;
  options: SelectionOption[];
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}

export interface SelectionParam extends BaseParam {
  type: "selection";
  defaultValue: string | string[];
  options: SelectionOption[];
  multiSelect?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  group?: SelectionGroup;
  /** Adds a "clear" row so a single-select can be returned to unset. */
  clearable?: boolean;
  /**
   * Renders the control inert but still as a control — unlike `readOnly`, which
   * collapses it to plain text and drops the option's icon.
   */
  disabled?: boolean;
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

export interface ParamEditorReadOnlyImage {
  src: string;
  alt: string;
}

export type ParamEditorReadOnlyContent =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>
  | { type: "image"; src: string; alt: string }
  | { type: "image-gallery"; images: ParamEditorReadOnlyImage[] };

/** Serializable display-only value rendered by the read-only Param Editor. */
export interface ReadOnlyParam extends BaseParam {
  type: "readOnly";
  value: ParamEditorReadOnlyContent;
}

/** A reference the host can open (e.g. another resource tab). */
export interface ResourceRefValue {
  type: string;
  id: string;
  label?: string;
}

/**
 * Serializable resource chip. Clicking it opens `href` externally, opens `ref` via
 * `onOpenResource`, or copies `copyText` to the clipboard — whichever is set.
 */
export interface ResourceOption {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  href?: string;
  ref?: ResourceRefValue;
  copyText?: string;
}

/**
 * Resource references rendered as tags/chips. View-only by default; set `editable`
 * to pick from `options` via a dropdown. Value is the selected option id(s), mirroring
 * {@link SelectionParam}, so it stays JSON-safe across the controls-command boundary.
 */
export interface ResourceParam extends BaseParam {
  type: "resource";
  defaultValue: string | string[];
  options: ResourceOption[];
  multiSelect?: boolean;
  editable?: boolean;
  placeholder?: string;
  emptyText?: string;
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

export type FileUploadStatus = "queued" | "uploading" | "complete" | "error";

/** A selected file and the host-controlled state of its upload. */
export interface FileUploadValue {
  id: string;
  file: File;
  status: FileUploadStatus;
  /** Host-owned upload ref. Set after the selected file reaches storage. */
  ref?: string;
  progress?: number;
  error?: string;
}

export interface FileUploadParam extends BaseParam {
  type: "fileUpload";
  defaultValue: FileUploadValue[];
  accept?: string;
  multiple?: boolean;
  uploadLabel?: string;
}

export interface InputGroup {
  id: string;
  title: string;
  description?: string;
  params: Param[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type ParamValue = number | string | boolean | null | string[] | RangeValue | VectorValue | FileUploadValue[];

export type Param =
  | NumberParam
  | BooleanParam
  | TextParam
  | MarkdownParam
  | SelectionParam
  | DateParam
  | ColorParam
  | PropertyParam
  | ReadOnlyParam
  | ResourceParam
  | RangeParam
  | SegmentedParam
  | ActionsParam
  | AnchorGridParam
  | VectorParam
  | FileUploadParam;

export type ParamValueMap = Record<string, ParamValue>;
