import type {
  BooleanParam,
  HarnessParam,
  JsonParam,
  LongTextParam,
  MultiSelectParam,
  NumberParam,
  RepoParam,
  ResourceParam,
  SelectParam,
  TemplateParam,
  TextParam,
} from "./types/params";

/**
 * Builders for typed parameter descriptors. Each builder produces a discriminated
 * `ParamDescriptor` so the runtime and editor only see fields valid for that type.
 *
 * @example
 *   params: {
 *     amount: params.number({ defaultValue: 1 }),
 *     mode: params.select({ options: [{ label: "Fast", value: "fast" }] }),
 *   }
 */
export const params = {
  text: (options: Omit<TextParam, "type"> = {}): TextParam => ({ type: "text", ...options }),

  longText: (options: Omit<LongTextParam, "type"> = {}): LongTextParam => ({ type: "longtext", ...options }),

  number: (options: Omit<NumberParam, "type"> = {}): NumberParam => ({ type: "number", ...options }),

  boolean: (options: Omit<BooleanParam, "type"> = {}): BooleanParam => ({ type: "boolean", ...options }),

  select: (options: Omit<SelectParam, "type">): SelectParam => ({ type: "select", ...options }),

  multiSelect: (options: Omit<MultiSelectParam, "type">): MultiSelectParam => ({
    type: "multi-select",
    ...options,
  }),

  repo: (options: Omit<RepoParam, "type"> = {}): RepoParam => ({ type: "repo", ...options }),

  harness: (options: Omit<HarnessParam, "type"> = {}): HarnessParam => ({ type: "harness", ...options }),

  template: (options: Omit<TemplateParam, "type" | "templateType"> & { type: string }): TemplateParam => ({
    label: options.label,
    description: options.description,
    required: options.required,
    defaultValue: options.defaultValue,
    metadata: options.metadata,
    type: "template",
    templateType: options.type,
  }),

  resource: (options: Omit<ResourceParam, "type">): ResourceParam => ({ type: "resource", ...options }),

  json: <T = unknown>(options: Omit<JsonParam<T>, "type"> = {}): JsonParam<T> => ({ type: "json", ...options }),
};
