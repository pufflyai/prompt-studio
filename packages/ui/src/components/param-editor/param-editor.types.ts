import type { BaseControl as BaseParam, ControlGroup, ControlParam, ControlValue } from "@pstdio/sdk/extensions";
import type { ReactNode } from "react";

export type {
  ActionOption,
  ActionsControl as ActionsParam,
  AnchorGridControl as AnchorGridParam,
  AnchorGridValue,
  BaseControl as BaseParam,
  BooleanControl as BooleanParam,
  ColorControl as ColorParam,
  ControlGroup,
  ControlParam,
  ControlValue,
  ControlValueMap,
  DateControl as DateParam,
  MarkdownControl as MarkdownParam,
  NumberControl as NumberParam,
  ParamEditorReadOnlyContent,
  ParamEditorReadOnlyImage,
  RangeControl as RangeParam,
  RangeValue,
  ReadOnlyControl as ReadOnlyParam,
  ResourceControl as ResourceParam,
  ResourceOption,
  ResourceRefValue,
  SegmentedControl as SegmentedParam,
  SegmentedOption,
  SelectionControl as SelectionParam,
  SelectionGroup,
  SelectionOption,
  TextControl as TextParam,
  VectorControl as VectorParam,
  VectorValue,
} from "@pstdio/sdk/extensions";

export interface PropertyParam extends BaseParam {
  type: "property";
  value: ReactNode;
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

export interface InputGroup extends Omit<ControlGroup, "params"> {
  params: Param[];
}
export type Param = ControlParam | PropertyParam | FileUploadParam;
export type ParamValue = ControlValue | FileUploadValue[];
export type ParamValueMap = Record<string, ParamValue>;
