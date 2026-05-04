import type { JsonObject } from "./json";
import type { ResourceRef } from "./resources";

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

interface ParamBase<TValue> {
  label?: string;
  description?: string;
  required?: boolean;
  defaultValue?: TValue;
  metadata?: JsonObject;
}

export interface TextParam extends ParamBase<string> {
  type: "text";
}

export interface LongTextParam extends ParamBase<string> {
  type: "longtext";
}

export interface NumberParam extends ParamBase<number> {
  type: "number";
}

export interface BooleanParam extends ParamBase<boolean> {
  type: "boolean";
}

export interface SelectParam extends ParamBase<string> {
  type: "select";
  options: Array<{ label: string; value: string }>;
}

export interface MultiSelectParam extends ParamBase<string[]> {
  type: "multi-select";
  options: Array<{ label: string; value: string }>;
}

export interface RepoParam extends ParamBase<{ repoId: string; branch?: string }> {
  type: "repo";
}

export interface HarnessParam extends ParamBase<{ harnessId: string; model?: string }> {
  type: "harness";
}

export interface TemplateParam extends ParamBase<string> {
  type: "template";
  templateType: string;
}

export interface ResourceParam extends ParamBase<ResourceRef> {
  type: "resource";
  resourceType: string;
}

export interface JsonParam<T = unknown> extends ParamBase<T> {
  type: "json";
}

export type ParamDescriptor<TValue = unknown> =
  | TextParam
  | LongTextParam
  | NumberParam
  | BooleanParam
  | SelectParam
  | MultiSelectParam
  | RepoParam
  | HarnessParam
  | TemplateParam
  | ResourceParam
  | JsonParam<TValue>;

export type ParamObjectSchema = Record<string, ParamDescriptor>;

export type ParamValue<TDescriptor extends ParamDescriptor> = TDescriptor extends ParamDescriptor<infer V> ? V : never;

export type ParamsOf<TSchema extends ParamObjectSchema> = {
  [K in keyof TSchema]: ParamValue<TSchema[K]>;
};
