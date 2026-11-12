import type { ParamEditorProps } from "@pstdio/ui/param-editor";
import { useRef, useState } from "react";

type Value = Parameters<NonNullable<ParamEditorProps["onChange"]>>[1];
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const without = <T>(values: Record<string, T>, name: string) => {
  const { [name]: _removed, ...remaining } = values;
  return remaining;
};

/** Drafts are local UI state. Accepted values and ordered writes remain owned by the registry. */
export const usePreferenceFormDraft = (
  persist: (name: string, value: Value) => void | Promise<void>,
  mode: "live" | "apply",
) => {
  const [staged, setStaged] = useState<Record<string, Value>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(0);
  const latest = useRef(new Map<string, symbol>());
  const saving = useRef<Promise<void> | undefined>(undefined);
  const accept = (name: string, value: Value) =>
    setStaged((current) =>
      JSON.stringify(current[name]) === JSON.stringify(value) ? without(current, name) : current,
    );
  const change = (name: string, value: Value) => {
    setStaged((current) => ({ ...current, [name]: value }));
    if (mode === "apply") return;
    const token = Symbol(name);
    latest.current.set(name, token);
    setPending((count) => count + 1);
    void Promise.resolve()
      .then(() => persist(name, value))
      .then(
        () => {
          if (latest.current.get(name) !== token) return;
          accept(name, value);
          setErrors((current) => without(current, name));
        },
        (error) => {
          if (latest.current.get(name) === token) setErrors((current) => ({ ...current, [name]: message(error) }));
        },
      )
      .finally(() => {
        if (latest.current.get(name) === token) latest.current.delete(name);
        setPending((count) => count - 1);
      });
  };
  const save = () => {
    if (saving.current) return saving.current;
    const values = Object.entries(staged);
    setPending((count) => count + 1);
    setErrors({});
    const saved = Promise.allSettled(values.map(([name, value]) => Promise.resolve().then(() => persist(name, value))))
      .then((results) => {
        // Wait for every accepted write before allowing teardown or reporting a failed batch.
        for (const result of results) if (result.status === "rejected") throw result.reason;
        for (const [name, value] of values) accept(name, value);
      })
      .finally(() => {
        saving.current = undefined;
        setPending((count) => count - 1);
      });
    saving.current = saved;
    return saved;
  };
  return {
    staged,
    errors,
    saving: pending > 0,
    change,
    save,
    discard() {
      setStaged({});
      setErrors({});
    },
  };
};
