import { createScopedQueryClient, type ScopedQuery, type ScopedQueryClient } from "@pstdio/sdk/extensions";
import { createStore } from "zustand/vanilla";
import type { CommandParamOption, CommandParamOptionSource, CommandParamSchema } from "./command-form-types";
import { type CommandParamValue, normalizeCommandParamValues } from "./command-param-values";

type Values = Record<string, CommandParamValue>;
export interface CommandOptionState {
  key: string;
  status: "loading" | "ready" | "error";
  options: CommandParamOption[];
  error?: string;
}
export type ExecuteOptionCommand = (
  commandId: string,
  args: Record<string, unknown>,
  signal?: AbortSignal,
) => Promise<unknown>;
const valueRef = (value: unknown): value is { kind: "param-value"; key: string } =>
  typeof value === "object" &&
  value !== null &&
  "kind" in value &&
  value.kind === "param-value" &&
  "key" in value &&
  typeof value.key === "string";
const argumentsFor = (
  source: CommandParamOptionSource,
  values: Values,
  schema: CommandParamSchema,
  resolved: Record<string, unknown>,
) =>
  Object.fromEntries(
    Object.entries(source.params ?? {}).map(([key, value]) => {
      if (!valueRef(value)) return [key, value];
      const descriptor = schema[value.key];
      if (descriptor?.resolvedFrom === "resource") return [key, resolved[value.key]];
      const normalized = descriptor
        ? normalizeCommandParamValues({ [value.key]: { ...descriptor, required: false } }, values)[value.key]
        : values[value.key];
      return [key, normalized];
    }),
  );

const readOptions = (source: CommandParamOptionSource, result: unknown): CommandParamOption[] => {
  if (!Array.isArray(result)) throw new Error("The option command must return a list.");
  return result.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row[source.valueField] !== "string" ||
      typeof row[source.labelField] !== "string"
    )
      throw new Error("The option command returned an invalid value or label.");
    return { value: row[source.valueField], label: row[source.labelField] };
  });
};

export function createCommandOptionResolver(
  schema: CommandParamSchema,
  execute: ExecuteOptionCommand,
  onChange: (key: string, value: CommandParamValue) => void,
  resolved: Record<string, unknown> = {},
  sharedQueries?: Pick<ScopedQueryClient, "query">,
) {
  const referencedValue = (key: string, values: Values) =>
    schema[key]?.resolvedFrom === "resource" ? resolved[key] : values[key];
  const queryKey = (source: CommandParamOptionSource, values: Values) =>
    JSON.stringify([
      source,
      Object.entries(source.params ?? {}).map(([key, value]) => [
        key,
        valueRef(value) ? referencedValue(value.key, values) : value,
      ]),
    ]);
  const projection = createStore<Record<string, CommandOptionState>>(() => ({}));
  const createQueries = () => createScopedQueryClient({ runtimeId: "command-form", extensionId: "form" });
  let queries = sharedQueries ?? createQueries();
  let values: Values = {};
  let disposed = false;
  const fields = new Map<string, { query: ScopedQuery<CommandParamOption[]>; stop(): void }>();
  const observers = new Set<() => void>();
  const sources = Object.entries(schema).flatMap(([key, param]) =>
    param.options && !Array.isArray(param.options) ? [{ key, param, source: param.options }] : [],
  );
  const publish = (key: string, state: CommandOptionState) => {
    projection.setState({ ...projection.getState(), [key]: state }, true);
  };
  const clearInvalidSelection = (key: string, options: CommandParamOption[]) => {
    const offered = new Set(options.map((option) => option.value));
    const current = values[key];
    if (Array.isArray(current)) {
      const next = current.filter((value) => offered.has(value));
      if (next.length !== current.length) onChange(key, next);
    } else if (typeof current === "string" && current && !offered.has(current)) onChange(key, "");
  };
  const release = (key: string) => {
    const previous = fields.get(key);
    if (!previous) return;
    fields.delete(key);
    previous.stop();
    if (!previous.query.active()) previous.query.cancel();
  };
  const load = (field: (typeof sources)[number], retry = false) => {
    const { key, source, param } = field;
    release(key);
    const requestKey = queryKey(source, values);
    const previousOptions = projection.getState()[key]?.options ?? [];
    publish(key, { key: requestKey, status: "loading", options: previousOptions });
    try {
      const args = argumentsFor(source, values, schema, resolved);
      const query = queries.query({
        id: "command.options",
        params: { source, args },
        read: async (signal) => readOptions(source, await execute(source.commandId, args, signal)),
      });
      if (retry) query.invalidate();
      const binding = { query, stop: () => {} };
      fields.set(key, binding);
      const observe = () => {
        if (disposed || fields.get(key) !== binding) return;
        const state = query.getSnapshot();
        const options = state.data ?? previousOptions;
        let status: CommandOptionState["status"] = "loading";
        if (!state.fetching && state.error) status = "error";
        else if (!state.fetching && state.data !== undefined) status = "ready";
        publish(key, { key: requestKey, status, options, error: state.error?.message });
        if (status === "ready" && !param.allowCustomValues) clearInvalidSelection(key, options);
      };
      // The common owner installs observation before executing the command.
      binding.stop = query.subscribe(observe);
      observe();
    } catch (error) {
      publish(key, {
        key: requestKey,
        status: "error",
        options: previousOptions,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return {
    subscribe(listener: () => void) {
      const stop = projection.subscribe(listener);
      observers.add(stop);
      return () => {
        stop();
        observers.delete(stop);
      };
    },
    getSnapshot: projection.getState,
    update(next: Values) {
      if (disposed && !sharedQueries) queries = createQueries();
      disposed = false;
      values = next;
      for (const field of sources)
        if (projection.getState()[field.key]?.key !== queryKey(field.source, values)) load(field);
    },
    retry(key: string) {
      const field = sources.find((field) => field.key === key);
      if (field && !disposed) load(field, true);
    },
    validate(next: Values) {
      const errors: Record<string, string> = {};
      for (const { key, param, source } of sources) {
        const state = projection.getState()[key];
        if (state?.status !== "ready" || state.key !== queryKey(source, next)) {
          errors[key] = "Wait for the available options to load.";
          continue;
        }
        if (param.allowCustomValues) continue;
        const value = next[key];
        const selected = Array.isArray(value) ? value : [value].filter(Boolean);
        if (selected.some((value) => !state.options.some((option) => option.value === value)))
          errors[key] = "Choose a value from the available options.";
      }
      return errors;
    },
    dispose() {
      disposed = true;
      for (const key of fields.keys()) release(key);
      if (!sharedQueries) (queries as ScopedQueryClient).dispose();
      for (const stop of observers) stop();
      observers.clear();
      projection.setState({}, true);
    },
  };
}
