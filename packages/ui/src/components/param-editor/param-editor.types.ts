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

export type ObjectDefinition = (NumberParam | TextParam)[];

export interface ObjectParam extends BaseParam {
  type: "object";
  defaultValue: ObjectDefinition;
  editableSchema?: boolean;
}

export interface ListParam extends BaseParam {
  type: "list";
  files?: boolean;
  defaultValue: string[];
}

export interface VectorParam extends BaseParam {
  type: "vector";
  defaultValue: [];
}

export interface InputGroup {
  id: string;
  title: string;
  description?: string;
  params: Param[];
  collapsible?: boolean;
  defaultCollapsed?: boolean;
}

export type ParamValue = number | string | null | ObjectDefinition | Array<number> | Array<string>;

export type Param =
  | NumberParam
  | TextParam
  | SelectionParam
  | DateParam
  | ColorParam
  | PropertyParam
  | ObjectParam
  | ListParam
  | VectorParam;

export type ParamValueMap = Record<string, ParamValue>;
