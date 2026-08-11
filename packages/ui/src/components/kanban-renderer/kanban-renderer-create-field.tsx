import { Button, Icon, Input, Stack, Text, Textarea, Wrap } from "@chakra-ui/react";
import { Paperclip } from "lucide-react";
import { useRef } from "react";
import { AttachmentChip } from "@/components/overlays/attachment-chip";
import { SelectionInput } from "@/components/param-editor/inputs/selection-input";
import { LazyMarkdownEditor } from "@/components/rich-text";
import type { KanbanRendererCreateField } from "./types";

// The editor and its syntax highlighting are heavy and only needed once a
// markdown field is actually on screen, so the host loads them on demand.
const MarkdownControl = (props: {
  disabled: boolean;
  field: KanbanRendererCreateField;
  onChange: (value: unknown) => void;
}) => {
  const { disabled, field, onChange } = props;

  return (
    <LazyMarkdownEditor
      // Seed from the declared default so a pre-filled field is visible rather
      // than blank-but-submittable. Lexical reads this once, on mount.
      defaultState={typeof field.defaultValue === "string" ? field.defaultValue : ""}
      isEditable={!disabled}
      placeholder={field.placeholder}
      autoFocus
      onChange={(next) => onChange(next)}
    />
  );
};

const FilesControl = (props: {
  disabled: boolean;
  field: KanbanRendererCreateField;
  removeLabel: string;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { disabled, field, removeLabel, value, onChange } = props;
  const input = useRef<HTMLInputElement>(null);
  const files = Array.isArray(value) ? (value as File[]) : [];

  return (
    <Stack gap="2xs" align="start">
      <input
        ref={input}
        hidden
        type="file"
        accept={field.accept}
        multiple={field.multiple !== false}
        // Appending keeps earlier picks; replacing silently discards them. A
        // single-file field replaces instead, so it can never hold two.
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          onChange(field.multiple === false ? picked.slice(0, 1) : [...files, ...picked]);
          event.target.value = "";
        }}
      />
      <Button size="xs" variant="ghost" disabled={disabled} onClick={() => input.current?.click()}>
        <Icon as={Paperclip} boxSize="4" />
        {field.label}
      </Button>
      {files.length > 0 ? (
        <Wrap gap="2xs">
          {files.map((file, index) => (
            <AttachmentChip
              key={`${file.name}-${index.toString()}`}
              file={file}
              disabled={disabled}
              removeLabel={removeLabel}
              onRemove={() => onChange(files.filter((_, itemIndex) => itemIndex !== index))}
            />
          ))}
        </Wrap>
      ) : null}
    </Stack>
  );
};

interface CreateFieldControlProps {
  disabled: boolean;
  field: KanbanRendererCreateField;
  removeLabel: string;
  value: unknown;
  onChange: (value: unknown) => void;
}

const FieldInput = (props: CreateFieldControlProps) => {
  const { disabled, field, value, onChange } = props;

  if (field.type === "longtext")
    return (
      <Textarea
        aria-label={field.label}
        minH="120px"
        size="sm"
        placeholder={field.placeholder}
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );

  // Declared selects share the ParamEditor's control, so they look and behave
  // exactly like the resource attributes rendered beside them.
  if (field.type === "select" || field.type === "multi-select")
    return (
      <SelectionInput
        hideLabel
        id={field.id}
        name={field.label}
        description={field.description ?? ""}
        defaultValue={(value as string | string[]) ?? (field.type === "multi-select" ? [] : "")}
        options={(field.options ?? []).map((option) => ({
          id: option.value,
          name: option.label,
          icon: option.icon ?? undefined,
          color: option.color,
        }))}
        multiSelect={field.type === "multi-select"}
        placeholder={field.placeholder ?? field.label}
        clearable={!field.required}
        readOnly={disabled}
        onChange={(_, next) => onChange(next)}
      />
    );

  if (field.type === "boolean")
    return (
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(value !== true)}>
        {field.label}
      </Button>
    );

  return (
    <Input
      aria-label={field.label}
      size="sm"
      type={field.type === "number" ? "number" : "text"}
      placeholder={field.placeholder}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(field.type === "number" && event.target.value ? Number(event.target.value) : event.target.value)
      }
    />
  );
};

export const CreateFieldControl = (props: CreateFieldControlProps) => {
  const { disabled, field, removeLabel, value, onChange } = props;

  // Files and markdown carry their own trigger label / placeholder, so the
  // stacked label above them would just repeat it.
  if (field.type === "files")
    return (
      <FilesControl disabled={disabled} field={field} removeLabel={removeLabel} value={value} onChange={onChange} />
    );

  if (field.type === "markdown") return <MarkdownControl disabled={disabled} field={field} onChange={onChange} />;

  return (
    <Stack gap="2xs">
      <Text textStyle="label/S/medium">{`${field.label}${field.required ? " *" : ""}`}</Text>
      {field.description ? (
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {field.description}
        </Text>
      ) : null}
      <FieldInput {...props} />
    </Stack>
  );
};
