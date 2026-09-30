import type { CommandParamOption, CommandParamOptionSource, CommandParamSchema } from "../../core";
import { type CommandParamValue, normalizeCommandParamValues } from "./command-palette-params";

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
const argumentsFor = (source: CommandParamOptionSource, values: Values, schema?: CommandParamSchema) =>
  Object.fromEntries(
    Object.entries(source.params ?? {}).map(([key, value]) => {
      if (!valueRef(value)) return [key, value];
      const descriptor = schema?.[value.key];
      const normalized = descriptor
        ? normalizeCommandParamValues({ [value.key]: { ...descriptor, required: false } }, values)[value.key]
        : values[value.key];
      return [key, normalized];
    }),
  );
const queryKey = (source: CommandParamOptionSource, values: Values) =>
  JSON.stringify([source, argumentsFor(source, values)]);
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
) {
  let snapshot: Record<string, CommandOptionState> = {};
  let values: Values = {};
  let disposed = false;
  const controllers = new Map<string, AbortController>();
  const listeners = new Set<() => void>();
  const requests = new Map<string, number>();
  const sources = Object.entries(schema).flatMap(([key, param]) =>
    param.options && !Array.isArray(param.options) ? [{ key, param, source: param.options }] : [],
  );
  const publish = (key: string, state: CommandOptionState) => {
    snapshot = { ...snapshot, [key]: state };
    for (const listener of listeners) listener();
  };
  const clearInvalidSelection = (key: string, options: CommandParamOption[]) => {
    const offered = new Set(options.map((option) => option.value));
    const current = values[key];
    if (Array.isArray(current)) {
      const next = current.filter((value) => offered.has(value));
      if (next.length !== current.length) onChange(key, next);
    } else if (typeof current === "string" && current && !offered.has(current)) onChange(key, "");
  };
  const load = async (field: (typeof sources)[number]) => {
    const { key, source, param } = field;
    controllers.get(key)?.abort();
    const controller = new AbortController();
    controllers.set(key, controller);
    const version = (requests.get(key) ?? 0) + 1;
    requests.set(key, version);
    const requestKey = queryKey(source, values);
    publish(key, { key: requestKey, status: "loading", options: [] });
    try {
      const options = readOptions(
        source,
        await execute(source.commandId, argumentsFor(source, values, schema), controller.signal),
      );
      if (disposed || requests.get(key) !== version) return;
      publish(key, { key: requestKey, status: "ready", options });
      if (param.allowCustomValues) return;
      clearInvalidSelection(key, options);
    } catch (error) {
      if (disposed || requests.get(key) !== version) return;
      publish(key, {
        key: requestKey,
        status: "error",
        options: [],
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    update(next: Values) {
      disposed = false;
      values = next;
      for (const field of sources) if (snapshot[field.key]?.key !== queryKey(field.source, values)) void load(field);
    },
    retry(key: string) {
      const field = sources.find((field) => field.key === key);
      if (field && !disposed) void load(field);
    },
    validate(next: Values) {
      const errors: Record<string, string> = {};
      for (const { key, param, source } of sources) {
        const state = snapshot[key];
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
      for (const controller of controllers.values()) controller.abort();
      for (const [key, version] of requests) requests.set(key, version + 1);
      snapshot = {};
      listeners.clear();
    },
  };
}
