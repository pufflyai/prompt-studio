// Edit a name or a date in place: click to edit, Enter or leaving the field saves, Escape cancels.
import { chakra, Editable, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";

interface InlineTextProps {
  value: string;
  label: string;
  placeholder?: string;
  color?: string;
  // Saves the trimmed value. A failed save shows the stored value again.
  onSave: (value: string) => Promise<unknown>;
}

export function InlineText(props: InlineTextProps) {
  const { value, label, placeholder, color, onSave } = props;
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = (next: string) => {
    const text = next.trim();
    if (text === value) {
      setDraft(value);
      return;
    }

    void onSave(text).catch(() => setDraft(value));
  };

  return (
    <Editable.Root
      value={draft}
      placeholder={placeholder}
      activationMode="click"
      submitMode="both"
      size="sm"
      minW="0"
      w="auto"
      textStyle="label/S/medium"
      color={color}
      onValueChange={(details) => setDraft(details.value)}
      onValueCommit={(details) => commit(details.value)}
      onValueRevert={() => setDraft(value)}
    >
      <Editable.Preview aria-label={`Edit ${label}`} truncate minW="0" px="2xs" cursor="text" />
      <Editable.Input aria-label={label} px="2xs" minW="12ch" />
    </Editable.Root>
  );
}

interface InlineDateProps {
  value: string;
  display: string;
  label: string;
  color?: string;
  onSave: (value: string) => Promise<unknown>;
}

// Native date input, shown only while editing so the timeline keeps its short date labels.
// Typing a year produces partial dates, so the value is saved on Enter or when the field loses focus.
export function InlineDate(props: InlineDateProps) {
  const { value, display, label, color, onSave } = props;
  const [draft, setDraft] = useState<string>();
  // Escape closes the field, and the blur that follows must not save it.
  const open = useRef(false);
  if (draft === undefined) {
    return (
      <Text
        as="button"
        aria-label={`Change ${label}`}
        textStyle="label/S/medium"
        color={color}
        whiteSpace="nowrap"
        cursor="text"
        onClick={() => {
          open.current = true;
          setDraft(value);
        }}
      >
        {display}
      </Text>
    );
  }

  const finish = (save: boolean) => {
    if (!open.current) {
      return;
    }

    open.current = false;
    setDraft(undefined);
    if (save && /^\d{4}-\d{2}-\d{2}$/.test(draft) && draft !== value) {
      void onSave(draft);
    }
  };

  return (
    <chakra.input
      type="date"
      autoFocus
      aria-label={label}
      value={draft}
      w="112px"
      textStyle="label/XS/regular"
      bg="bg"
      borderWidth="1px"
      borderColor="border"
      borderRadius="sm"
      onChange={(event) => setDraft(event.currentTarget.value)}
      onBlur={() => finish(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          finish(event.key === "Enter");
        }
      }}
    />
  );
}
