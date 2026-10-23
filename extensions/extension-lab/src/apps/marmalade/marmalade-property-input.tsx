import { Input } from "@chakra-ui/react";
import { useState } from "react";

interface MarmaladePropertyInputProps {
  id: string;
  label: string;
  value: string | number;
  type?: "number" | "text";
  disabled?: boolean;
  min?: number;
  max?: number;
  onEdit(value: string): void;
}

export const MarmaladePropertyInput = (props: MarmaladePropertyInputProps) => {
  const { id, label, value, type = "text", disabled, min, max, onEdit } = props;
  const [draft, setDraft] = useState<string>();
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
      onFocus={() => setDraft(String(value))}
      onChange={(event) => {
        setDraft(event.target.value);
        onEdit(event.target.value);
      }}
      onBlur={() => setDraft(undefined)}
    />
  );
};
