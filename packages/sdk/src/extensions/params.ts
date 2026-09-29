import type {
  BooleanParam,
  FilesParam,
  HarnessParam,
  JsonParam,
  ListParam,
  LongTextParam,
  MarkdownParam,
  MultiSelectParam,
  NumberParam,
  ParamValueRef,
  ResourceParam,
  SelectParam,
  TemplateParam,
  TextParam,
  WorkspaceParam,
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
  valueOf: (key: string) => ({ kind: "param-value", key }) satisfies ParamValueRef,

  text: <const TOptions extends ParamOptions<TextParam> | undefined = undefined>(
    options?: TOptions,
  ): TextParam<RequiredOf<TOptions>> => ({ type: "text", ...options }) as TextParam<RequiredOf<TOptions>>,

  longText: <const TOptions extends ParamOptions<LongTextParam> | undefined = undefined>(
    options?: TOptions,
  ): LongTextParam<RequiredOf<TOptions>> => ({ type: "longtext", ...options }) as LongTextParam<RequiredOf<TOptions>>,

  markdown: <const TOptions extends ParamOptions<MarkdownParam> | undefined = undefined>(
    options?: TOptions,
  ): MarkdownParam<RequiredOf<TOptions>> => ({ type: "markdown", ...options }) as MarkdownParam<RequiredOf<TOptions>>,

  files: <const TOptions extends ParamOptions<FilesParam> | undefined = undefined>(
    options?: TOptions,
  ): FilesParam<RequiredOf<TOptions>> => ({ type: "files", ...options }) as FilesParam<RequiredOf<TOptions>>,

  number: <const TOptions extends ParamOptions<NumberParam> | undefined = undefined>(
    options?: TOptions,
  ): NumberParam<RequiredOf<TOptions>> => ({ type: "number", ...options }) as NumberParam<RequiredOf<TOptions>>,

  boolean: <const TOptions extends ParamOptions<BooleanParam> | undefined = undefined>(
    options?: TOptions,
  ): BooleanParam<RequiredOf<TOptions>> => ({ type: "boolean", ...options }) as BooleanParam<RequiredOf<TOptions>>,

  select: <const TOptions extends ParamOptions<SelectParam>>(options: TOptions) => ({
    type: "select" as const,
    ...options,
  }),

  multiSelect: <const TOptions extends ParamOptions<MultiSelectParam>>(options: TOptions) => ({
    type: "multi-select" as const,
    ...options,
  }),

  harness: <const TOptions extends ParamOptions<HarnessParam> | undefined = undefined>(
    options?: TOptions,
  ): HarnessParam<RequiredOf<TOptions>> => ({ type: "harness", ...options }) as HarnessParam<RequiredOf<TOptions>>,

  workspace: <const TOptions extends ParamOptions<WorkspaceParam> | undefined = undefined>(
    options?: TOptions,
  ): WorkspaceParam<RequiredOf<TOptions>> =>
    ({ type: "workspace", ...options }) as WorkspaceParam<RequiredOf<TOptions>>,

  template: <const TOptions extends Omit<TemplateParam, "type" | "templateType"> & { type: string }>(
    options: TOptions,
  ): TemplateParam<RequiredOf<TOptions>> => {
    const { type: templateType, ...rest } = options;
    return { type: "template", templateType, ...rest } as unknown as TemplateParam<RequiredOf<TOptions>>;
  },

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
