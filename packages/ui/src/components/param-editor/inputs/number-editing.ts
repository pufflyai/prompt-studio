import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface NumberEditingOptions {
  value: number;
  mixed?: boolean;
  min?: number;
  max?: number;
  step?: number;
  onPreview(value: number, interaction: "input" | "slider"): void | Promise<void>;
  onCommit(value: number): void | Promise<void>;
  onCancel(): void | Promise<void>;
}

/** Authored input survives incoming previews and acknowledgements until its own completion. */
export const useNumberEditing = (options: NumberEditingOptions) => {
  const { value, mixed, min, max, step = 1, onPreview, onCommit, onCancel } = options;
  const cancel = useRef(onCancel);
  useLayoutEffect(() => {
    cancel.current = onCancel;
  }, [onCancel]);
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const pending = useRef<
    | {
        raw: string;
        valid: boolean;
        interaction: "input" | "slider";
        intent: "commit" | "cancel";
        commit: typeof onCommit;
      }
    | undefined
  >(undefined);
  const revision = useRef(0);
  const saving = useRef<number | undefined>(undefined);
  const cancelling = useRef<number | undefined>(undefined);
  const focused = useRef(false);
  const report = (error: unknown, ownRevision = revision.current) => {
    if (revision.current === ownRevision) setError(error instanceof Error ? error.message : String(error));
  };
  const observe = (action: () => void | Promise<void>) => {
    const ownRevision = revision.current;
    try {
      void Promise.resolve(action()).catch((error) => report(error, ownRevision));
    } catch (error) {
      report(error, ownRevision);
    }
  };
  const valid = (raw: string) => {
    const number = Number(raw);
    const steps = (number - (min ?? 0)) / step;
    return (
      raw.trim() !== "" &&
      Number.isFinite(number) &&
      (min === undefined || number >= min) &&
      (max === undefined || number <= max) &&
      (step <= 0 || Math.abs(steps - Math.round(steps)) < 1e-7)
    );
  };
  useEffect(
    () => () => {
      const current = pending.current;
      pending.current = undefined;
      const finish = async () => {
        try {
          if (current?.valid && current.interaction === "input" && current.intent === "commit") {
            await current.commit(Number(current.raw));
          } else if (current) await cancel.current();
        } catch (error) {
          // The document owner retains required writes after disposal; also observe callback rejections.
          setError(error instanceof Error ? error.message : String(error));
        }
      };
      void finish();
    },
    [],
  );
  const clearCompletedDraft = () => {
    if (!focused.current && saving.current === undefined && cancelling.current === undefined) setDraft(undefined);
  };
  return {
    value: draft ?? (mixed ? "" : String(value)),
    invalid: draft !== undefined && !valid(draft),
    error,
    focus() {
      focused.current = true;
    },
    blur() {
      focused.current = false;
    },
    change(raw: string, interaction: "input" | "slider" = "input") {
      const acceptable = valid(raw);
      const cancelPrevious = !acceptable && pending.current?.valid;
      pending.current = { raw, valid: acceptable, interaction, intent: "commit", commit: onCommit };
      revision.current++;
      setError("");
      setDraft(raw);
      if (cancelPrevious) observe(onCancel);
      if (acceptable) observe(() => onPreview(Number(raw), interaction));
    },
    async commit() {
      const current = pending.current;
      if (!current) {
        clearCompletedDraft();
        return;
      }
      if (!current.valid || current.intent === "cancel") return;
      pending.current = undefined;
      const accepted = ++revision.current;
      saving.current = accepted;
      try {
        await current.commit(Number(current.raw));
        if (revision.current !== accepted) return;
        setError("");
        if (!focused.current) setDraft(undefined);
      } catch (error) {
        if (revision.current !== accepted) return;
        pending.current = current;
        setError(error instanceof Error ? error.message : String(error));
      } finally {
        if (saving.current === accepted) saving.current = undefined;
      }
    },
    async cancel() {
      const current = pending.current;
      if (!current && cancelling.current !== undefined) return;
      if (current) current.intent = "cancel";
      pending.current = undefined;
      const accepted = ++revision.current;
      cancelling.current = accepted;
      try {
        if (current) await cancel.current();
        if (revision.current === accepted) {
          setDraft(undefined);
          setError("");
        }
      } catch (error) {
        if (revision.current !== accepted) return;
        pending.current = current;
        report(error, accepted);
      } finally {
        if (cancelling.current === accepted) cancelling.current = undefined;
      }
    },
  };
};
