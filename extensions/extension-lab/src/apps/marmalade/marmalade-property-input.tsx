import { Input } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

interface MarmaladePropertyInputProps {
  id: string;
  label: string;
  value: string | number;
  type?: "number" | "text";
  disabled?: boolean;
  min?: number;
  max?: number;
  required?: boolean;
  onPreview(value: string): void | Promise<void>;
  onEdit(value: string): void | Promise<void>;
  onCancel(): void | Promise<void>;
}

export const MarmaladePropertyInput = (props: MarmaladePropertyInputProps) => {
  const { id, label, value, type = "text", disabled, min, max, required, onPreview, onEdit, onCancel } = props;
  const [draft, setDraft] = useState<string>();
  const focused = useRef(false);
  const pending = useRef<{ value: string; valid: boolean; edit: typeof onEdit; cancel: typeof onCancel } | undefined>(
    undefined,
  );
  const revision = useRef(0);
  const valid = (raw: string) => {
    if (required && !raw.trim()) return false;
    if (type !== "number") return true;
    return (
      raw.trim() !== "" &&
      Number.isFinite(Number(raw)) &&
      (min === undefined || Number(raw) >= min) &&
      (max === undefined || Number(raw) <= max)
    );
  };
  useEffect(
    () => () => {
      const current = pending.current;
      pending.current = undefined;
      if (current?.valid) void current.edit(current.value);
      else if (current) void current.cancel();
    },
    [],
  );
  return (
    <Input
      id={id}
      aria-label={label}
      size="xs"
      type={type}
      disabled={disabled}
      min={min}
      max={max}
      value={draft ?? value}
      aria-invalid={draft !== undefined && !valid(draft)}
      onFocus={() => {
        focused.current = true;
        setDraft((current) => current ?? String(value));
      }}
      onChange={(event) => {
        const next = event.target.value;
        const acceptable = valid(next);
        if (!acceptable && pending.current?.valid) void onCancel();
        setDraft(next);
        pending.current = { value: next, valid: acceptable, edit: onEdit, cancel: onCancel };
        revision.current++;
        if (acceptable) void onPreview(next);
      }}
      onBlur={async () => {
        focused.current = false;
        const current = pending.current;
        pending.current = undefined;
        if (!current) {
          setDraft(undefined);
          return;
        }
        if (!current.valid) {
          void current.cancel();
          return;
        }
        const acceptedRevision = revision.current;
        await current.edit(current.value);
        if (!focused.current && revision.current === acceptedRevision) setDraft(undefined);
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          pending.current = undefined;
          revision.current++;
          setDraft(undefined);
          void onCancel();
        }
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
};
