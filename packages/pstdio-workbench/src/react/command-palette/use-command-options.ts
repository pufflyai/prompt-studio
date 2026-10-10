import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CommandParamSchema } from "../../core";
import { createCommandOptionResolver, type ExecuteOptionCommand } from "./command-option-resolver";
import type { CommandParamValue } from "./command-palette-params";

export const useCommandOptions = (
  schema: CommandParamSchema,
  values: Record<string, CommandParamValue>,
  execute: ExecuteOptionCommand | undefined,
  onChange: (key: string, value: CommandParamValue) => void,
  resolved: Record<string, unknown> = {},
) => {
  const callbacks = useRef({ execute, onChange });
  callbacks.current = { execute, onChange };
  const [resolver] = useState(() =>
    createCommandOptionResolver(
      schema,
      (id, args, signal) => {
        if (!callbacks.current.execute) return Promise.reject(new Error("Option commands are unavailable."));
        return callbacks.current.execute(id, args, signal);
      },
      (key, value) => callbacks.current.onChange(key, value),
      resolved,
    ),
  );
  const states = useSyncExternalStore(resolver.subscribe, resolver.getSnapshot, resolver.getSnapshot);
  useEffect(() => {
    resolver.update(values);
  }, [resolver, values]);
  useEffect(() => () => resolver.dispose(), [resolver]);
  return { states, validate: resolver.validate, retry: resolver.retry };
};
