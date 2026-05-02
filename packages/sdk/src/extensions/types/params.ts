import type { JsonObject } from "./json";

export type ParamType =
  | "text"
  | "longtext"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "repo"
  | "harness"
  | "template"
  | "resource"
  | "json";

export interface ParamDescriptor<TValue = unknown> {
  type: ParamType;
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: TValue;
  options?: Array<{ label: string; value: string }>;
  templateType?: string;
  resourceType?: string;
  metadata?: JsonObject;
}

export type ParamObjectSchema = Record<string, ParamDescriptor>;
