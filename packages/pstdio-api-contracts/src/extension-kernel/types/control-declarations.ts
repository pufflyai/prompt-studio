import type { ResourceRef } from "./resources";

export interface BaseControl {
  id: string;
  name: string;
  description?: string;
  /** Locks this one param while the rest of the editor stays editable. */
  readOnly?: boolean;
}

export interface NumberControl extends BaseControl {
  type: "number";
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanControl extends BaseControl {
  type: "boolean";
  defaultValue: boolean;
}

export interface TextControl extends BaseControl {
  type: "text";
  defaultValue: string;
  singleLine?: boolean;
}

export interface MarkdownControl extends BaseControl {
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

export interface SelectionControl extends BaseControl {
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

export interface DateControl extends BaseControl {
  type: "date";
  defaultValue: string;
  min?: string;
  max?: string;
}

export interface ColorControl extends BaseControl {
  type: "color";
  defaultValue: string;
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
export interface ReadOnlyControl extends BaseControl {
  type: "readOnly";
  value: ParamEditorReadOnlyContent;
}

/** A reference the host can open (e.g. another resource tab). */
export type ResourceRefValue = ResourceRef;

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
 * {@link SelectionControl}, so it stays JSON-safe across the controls-command boundary.
 */
export interface ResourceControl extends BaseControl {
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
export interface RangeControl extends BaseControl {
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
export interface SegmentedControl extends BaseControl {
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
export interface ActionsControl extends BaseControl {
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
export interface AnchorGridControl extends BaseControl {
  type: "anchorGrid";
  defaultValue: AnchorGridValue;
}

export type VectorValue = {
  x: number;
  y: number;
};

/** Paired x/y numeric control. */
export interface VectorControl extends BaseControl {
  type: "vector";
  defaultValue: VectorValue;
  coordinateMode?: "cartesian" | "screen";
  xLabel?: string;
  yLabel?: string;
  min?: number;
  max?: number;
  step?: number;
}

export type ControlParam =
  | NumberControl
  | BooleanControl
  | TextControl
  | MarkdownControl
  | SelectionControl
  | DateControl
  | ColorControl
  | ReadOnlyControl
  | ResourceControl
  | RangeControl
  | SegmentedControl
  | ActionsControl
  | AnchorGridControl
  | VectorControl;

export interface ControlGroup {
  id: string;
  title: string;
  description?: string;
  params: ControlParam[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type ControlValue = number | string | boolean | null | string[] | RangeValue | VectorValue;
export type ControlValueMap = Record<string, ControlValue>;
