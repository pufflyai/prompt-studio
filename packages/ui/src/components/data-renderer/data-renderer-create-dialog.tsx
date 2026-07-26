import { Button, CloseButton, Dialog, HStack, Input, Menu, Stack, Text, Textarea, Wrap } from "@chakra-ui/react";
import { Check, ChevronDown, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getEnumOptions } from "./data-renderer-helpers";
import type {
  AttributeDescriptor,
  DataRendererCreateField,
  DataRendererCreateRowConfig,
  DataRendererCreateSubmission,
  EnumOption,
} from "./types";

interface DataRendererCreateDialogProps {
  open: boolean;
  columnId: string;
  columnLabel: string;
  columnAttributeId?: string;
  attributes: AttributeDescriptor[];
  config: DataRendererCreateRowConfig;
  onClose: () => void;
  onSubmit: (submission: DataRendererCreateSubmission) => Promise<void> | void;
}

const initialFieldValues = (fields: DataRendererCreateField[]) =>
  Object.fromEntries(
    fields.map((field) => [
      field.id,
      field.defaultValue ?? (field.type === "multi-select" ? [] : field.type === "boolean" ? false : ""),
    ]),
  );

const isFilled = (field: DataRendererCreateField, value: unknown) => {
  if (!field.required) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
};

const selectedOptionLabel = (options: EnumOption[], value: unknown, fallback: string) => {
  const values = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  const labels = values.map((item) => options.find((option) => option.value === item)?.label ?? item);
  return labels.length > 0 ? labels.join(", ") : fallback;
};

const SelectionControl = (props: {
  disabled: boolean;
  label: string;
  multi: boolean;
  options: EnumOption[];
  value: unknown;
  onChange: (value: string | string[]) => void;
}) => {
  const { disabled, label, multi, options, value, onChange } = props;
  const selected = Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [];
  const toggle = (optionValue: string) => {
    if (!multi) {
      onChange(optionValue);
      return;
    }
    onChange(
      selected.includes(optionValue) ? selected.filter((item) => item !== optionValue) : [...selected, optionValue],
    );
  };

  return (
    <Menu.Root closeOnSelect={!multi}>
      <Menu.Trigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          {selectedOptionLabel(options, value, label)}
          <ChevronDown size={14} aria-hidden="true" />
        </Button>
      </Menu.Trigger>
      <Menu.Positioner>
        <Menu.Content>
          {options.map((option) => (
            <Menu.Item key={option.value} value={option.value} onClick={() => toggle(option.value)}>
              <HStack gap="2">
                {selected.includes(option.value) ? <Check size={14} aria-hidden="true" /> : null}
                <Text>{option.label}</Text>
              </HStack>
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Positioner>
    </Menu.Root>
  );
};

const CreateFieldInput = (props: {
  disabled: boolean;
  field: DataRendererCreateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { disabled, field, value, onChange } = props;

  if (field.type === "longtext")
    return (
      <Textarea
        aria-label={field.label}
        minH="120px"
        size="sm"
        value={typeof value === "string" ? value : ""}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    );

  if (field.type === "select" || field.type === "multi-select")
    return (
      <SelectionControl
        disabled={disabled}
        label={`Select ${field.label.toLowerCase()}`}
        multi={field.type === "multi-select"}
        options={field.options ?? []}
        value={value}
        onChange={onChange}
      />
    );

  if (field.type === "boolean")
    return (
      <Button size="sm" variant="outline" disabled={disabled} onClick={() => onChange(value !== true)}>
        {value === true ? "Enabled" : "Disabled"}
      </Button>
    );

  return (
    <Input
      aria-label={field.label}
      size="sm"
      type={field.type === "number" ? "number" : "text"}
      value={typeof value === "string" || typeof value === "number" ? value : ""}
      disabled={disabled}
      onChange={(event) =>
        onChange(field.type === "number" && event.target.value ? Number(event.target.value) : event.target.value)
      }
    />
  );
};

const CreateFieldControl = (props: {
  disabled: boolean;
  field: DataRendererCreateField;
  value: unknown;
  onChange: (value: unknown) => void;
}) => {
  const { disabled, field, value, onChange } = props;
  const label = `${field.label}${field.required ? " *" : ""}`;

  return (
    <Stack gap="2xs">
      <Text textStyle="label/S/medium">{label}</Text>
      {field.description ? (
        <Text textStyle="paragraph/XS/regular" color="fg.muted">
          {field.description}
        </Text>
      ) : null}
      <CreateFieldInput disabled={disabled} field={field} value={value} onChange={onChange} />
    </Stack>
  );
};

const editableCreateAttributes = (attributes: AttributeDescriptor[], enabled: boolean | undefined) =>
  enabled
    ? attributes.filter(
        (attribute) => attribute.editable && (attribute.type.kind === "enum" || attribute.type.kind === "enum-multi"),
      )
    : [];

const initialAttributeValues = (
  attributes: AttributeDescriptor[],
  columnAttributeId: string | undefined,
  columnId: string,
) =>
  Object.fromEntries(
    attributes.map((attribute) => [
      attribute.id,
      attribute.id === columnAttributeId ? columnId : attribute.type.kind === "enum-multi" ? [] : "",
    ]),
  );

export const DataRendererCreateDialog = (props: DataRendererCreateDialogProps) => {
  const { open, columnId, columnLabel, columnAttributeId, attributes, config, onClose, onSubmit } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [attributeValues, setAttributeValues] = useState<Record<string, string | string[]>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const editableAttributes = editableCreateAttributes(attributes, config.includeEditableAttributes);

  useEffect(() => {
    if (!open) return;
    setValues(initialFieldValues(config.fields));
    setAttributeValues(
      initialAttributeValues(
        editableCreateAttributes(attributes, config.includeEditableAttributes),
        columnAttributeId,
        columnId,
      ),
    );
    setFiles([]);
    setError("");
  }, [attributes, columnAttributeId, columnId, config.fields, config.includeEditableAttributes, open]);

  const close = () => {
    if (!submitting) onClose();
  };
  const valid = config.fields.every((field) => isFilled(field, values[field.id]));
  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({ columnId, columnAttributeId, values, attributeValues, files });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create resource.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} size="lg" scrollBehavior="inside" onOpenChange={(details) => !details.open && close()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="calc(100% - 48px)">
          <Dialog.Header>
            <Stack gap="2xs">
              <Text textStyle="heading/M/semibold">{config.title}</Text>
              <Text textStyle="paragraph/XS/regular" color="fg.muted">
                Status · {columnLabel}
              </Text>
            </Stack>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={submitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="md">
              {config.fields.map((field) => (
                <CreateFieldControl
                  key={field.id}
                  field={field}
                  value={values[field.id]}
                  disabled={submitting}
                  onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
                />
              ))}
              {editableAttributes.length > 0 ? (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">Properties</Text>
                  <Wrap gap="2xs">
                    {editableAttributes.map((attribute) => (
                      <SelectionControl
                        key={attribute.id}
                        disabled={submitting || attribute.id === columnAttributeId}
                        label={attribute.label}
                        multi={attribute.type.kind === "enum-multi"}
                        options={getEnumOptions(attribute.type)}
                        value={attributeValues[attribute.id]}
                        onChange={(value) => setAttributeValues((current) => ({ ...current, [attribute.id]: value }))}
                      />
                    ))}
                  </Wrap>
                </Stack>
              ) : null}
              {files.length > 0 ? (
                <Wrap gap="2xs">
                  {files.map((file, index) => (
                    <Button
                      key={`${file.name}-${index.toString()}`}
                      size="xs"
                      variant="subtle"
                      disabled={submitting}
                      onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      {file.name}
                      <X size={12} aria-hidden="true" />
                    </Button>
                  ))}
                </Wrap>
              ) : null}
              {error ? (
                <Text textStyle="paragraph/S/regular" color="fg.error">
                  {error}
                </Text>
              ) : null}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer justifyContent="space-between">
            {config.allowAttachments ? (
              <>
                <input
                  ref={fileInput}
                  hidden
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
                <Button size="sm" variant="ghost" disabled={submitting} onClick={() => fileInput.current?.click()}>
                  <Paperclip size={14} aria-hidden="true" />
                  Attach files
                </Button>
              </>
            ) : (
              <span />
            )}
            <HStack gap="2">
              <Button size="sm" variant="ghost" disabled={submitting} onClick={close}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" disabled={!valid} loading={submitting} onClick={() => void submit()}>
                {config.submitLabel}
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
