import type {
  BooleanParam,
  HarnessParam,
  JsonParam,
  ListParam,
  LongTextParam,
  MultiSelectParam,
  NumberParam,
  RepoParam,
  ResourceParam,
  SelectParam,
  TemplateParam,
  TextParam,
} from "pstdio-api-contracts/extension-kernel";

type RequiredOf<TOptions> = TOptions extends { required: infer TRequired extends boolean } ? TRequired : undefined;

type ParamOptions<TParam extends { type: string }> = Omit<TParam, "type">;

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
  text: <const TOptions extends ParamOptions<TextParam> | undefined = undefined>(
    options?: TOptions,
  ): TextParam<RequiredOf<TOptions>> => ({ type: "text", ...options }) as TextParam<RequiredOf<TOptions>>,

  longText: <const TOptions extends ParamOptions<LongTextParam> | undefined = undefined>(
    options?: TOptions,
  ): LongTextParam<RequiredOf<TOptions>> => ({ type: "longtext", ...options }) as LongTextParam<RequiredOf<TOptions>>,

  number: <const TOptions extends ParamOptions<NumberParam> | undefined = undefined>(
    options?: TOptions,
  ): NumberParam<RequiredOf<TOptions>> => ({ type: "number", ...options }) as NumberParam<RequiredOf<TOptions>>,

  boolean: <const TOptions extends ParamOptions<BooleanParam> | undefined = undefined>(
    options?: TOptions,
  ): BooleanParam<RequiredOf<TOptions>> => ({ type: "boolean", ...options }) as BooleanParam<RequiredOf<TOptions>>,

  select: <const TOptions extends ParamOptions<SelectParam>>(options: TOptions): SelectParam<RequiredOf<TOptions>> =>
    ({ type: "select", ...options }) as unknown as SelectParam<RequiredOf<TOptions>>,

  multiSelect: <const TOptions extends ParamOptions<MultiSelectParam>>(
    options: TOptions,
  ): MultiSelectParam<RequiredOf<TOptions>> =>
    ({
      type: "multi-select",
      ...options,
    }) as unknown as MultiSelectParam<RequiredOf<TOptions>>,

  repo: <const TOptions extends ParamOptions<RepoParam> | undefined = undefined>(
    options?: TOptions,
  ): RepoParam<RequiredOf<TOptions>> => ({ type: "repo", ...options }) as RepoParam<RequiredOf<TOptions>>,

  harness: <const TOptions extends ParamOptions<HarnessParam> | undefined = undefined>(
    options?: TOptions,
  ): HarnessParam<RequiredOf<TOptions>> => ({ type: "harness", ...options }) as HarnessParam<RequiredOf<TOptions>>,

  template: <const TOptions extends Omit<TemplateParam, "type" | "templateType"> & { type: string }>(
    options: TOptions,
  ): TemplateParam<RequiredOf<TOptions>> =>
    ({
      label: options.label,
      description: options.description,
      required: options.required,
      defaultValue: options.defaultValue,
      metadata: options.metadata,
      type: "template",
      templateType: options.type,
    }) as TemplateParam<RequiredOf<TOptions>>,

  resource: <const TOptions extends ParamOptions<ResourceParam>>(
    options: TOptions,
  ): ResourceParam<RequiredOf<TOptions>> =>
    ({ type: "resource", ...options }) as unknown as ResourceParam<RequiredOf<TOptions>>,

  json: <T = unknown, const TOptions extends ParamOptions<JsonParam<T>> | undefined = undefined>(
    options?: TOptions,
  ): JsonParam<T, RequiredOf<TOptions>> => ({ type: "json", ...options }) as JsonParam<T, RequiredOf<TOptions>>,

  list: <const TOptions extends ParamOptions<ListParam> | undefined = undefined>(
    options?: TOptions,
  ): ListParam<RequiredOf<TOptions>> => ({ type: "list", ...options }) as ListParam<RequiredOf<TOptions>>,
};
