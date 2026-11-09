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
  onEdit(value: string): void | Promise<void>;
}

export const MarmaladePropertyInput = (props: MarmaladePropertyInputProps) => {
  const { id, label, value, type = "text", disabled, min, max, onEdit } = props;
  const [draft, setDraft] = useState<string>();
  const focused = useRef(false);
  const pending = useRef<{ value: string; edit: typeof onEdit } | undefined>(undefined);
  const revision = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const committing = useRef(Promise.resolve());
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      const edit = pending.current;
      pending.current = undefined;
      if (edit) void edit.edit(edit.value);
    },
    [],
  );
  const save = (edit: { value: string; edit: typeof onEdit }) => {
    pending.current = undefined;
    committing.current = Promise.resolve(edit.edit(edit.value));
    return committing.current;
  };
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
      onFocus={() => {
        focused.current = true;
        setDraft((current) => current ?? String(value));
      }}
      onChange={(event) => {
        const next = event.target.value;
        setDraft(next);
        const edit = { value: next, edit: onEdit };
        pending.current = edit;
        revision.current += 1;
        clearTimeout(timer.current);
        // Match the shared property editor: save after a pause, then flush the final draft on blur.
        timer.current = setTimeout(() => {
          void save(edit);
        }, 540);
      }}
      onBlur={async () => {
        focused.current = false;
        clearTimeout(timer.current);
        if (pending.current !== undefined) void save(pending.current);
        const savedRevision = revision.current;
        const commit = committing.current;
        await commit;
        if (!focused.current && revision.current === savedRevision && committing.current === commit) {
          setDraft(undefined);
        }
      }}
    />
  );
};
