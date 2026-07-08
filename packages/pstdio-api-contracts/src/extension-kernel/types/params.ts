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
  | "json"
  | "list";

type ParamRequired<TRequired extends boolean | undefined> = TRequired extends true
  ? { required: true }
  : TRequired extends false
    ? { required: false }
    : { required?: boolean };

type ParamBase<TValue, TRequired extends boolean | undefined = boolean | undefined> = {
  label?: string;
  description?: string;
  defaultValue?: TValue;
  metadata?: JsonObject;
} & ParamRequired<TRequired>;

export type TextParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "text";
};

export type LongTextParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  string,
  TRequired
> & {
  type: "longtext";
};

export type NumberParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<number, TRequired> & {
  type: "number";
};

export type BooleanParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  boolean,
  TRequired
> & {
  type: "boolean";
};

type ParamOption = { label: string; value: string; icon?: string };

export type SelectParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string, TRequired> & {
  type: "select";
  options: ParamOption[];
};

export type MultiSelectParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  string[],
  TRequired
> & {
  type: "multi-select";
  options: ParamOption[];
};

export type RepoParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  { repoId: string; branch?: string },
  TRequired
> & {
  type: "repo";
};

export type HarnessParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  { harnessId: string; model?: string; params?: Record<string, string | boolean> },
  TRequired
> & {
  type: "harness";
};

export type TemplateParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  string,
  TRequired
> & {
  type: "template";
  templateType: string;
};

export type ResourceParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  ResourceRef,
  TRequired
> & {
  type: "resource";
  resourceType: string;
};

export type JsonParam<T = unknown, TRequired extends boolean | undefined = boolean | undefined> = ParamBase<
  T,
  TRequired
> & {
  type: "json";
};

// A repeatable string flag on the CLI (`--tag a --tag b` → ["a", "b"]); a plain
// string array everywhere else.
export type ListParam<TRequired extends boolean | undefined = boolean | undefined> = ParamBase<string[], TRequired> & {
  type: "list";
};

export type ParamDescriptor<TValue = unknown, TRequired extends boolean | undefined = boolean | undefined> =
  | TextParam<TRequired>
  | LongTextParam<TRequired>
  | NumberParam<TRequired>
  | BooleanParam<TRequired>
  | SelectParam<TRequired>
  | MultiSelectParam<TRequired>
  | RepoParam<TRequired>
  | HarnessParam<TRequired>
  | TemplateParam<TRequired>
  | ResourceParam<TRequired>
  | JsonParam<TValue, TRequired>
  | ListParam<TRequired>;

export type ParamObjectSchema = Record<string, ParamDescriptor>;

export type ParamValue<TDescriptor extends ParamDescriptor> = TDescriptor extends ParamDescriptor<infer V> ? V : never;

type RequiredParamKeys<TSchema extends ParamObjectSchema> = {
  [K in keyof TSchema]: TSchema[K] extends { required: true } ? K : never;
}[keyof TSchema];

type OptionalParamKeys<TSchema extends ParamObjectSchema> = Exclude<keyof TSchema, RequiredParamKeys<TSchema>>;

export type ParamsOf<TSchema extends ParamObjectSchema> = {
  [K in RequiredParamKeys<TSchema>]: ParamValue<TSchema[K]>;
} & {
  [K in OptionalParamKeys<TSchema>]?: ParamValue<TSchema[K]>;
};
