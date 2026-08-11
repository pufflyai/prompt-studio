import { Button, CloseButton, Dialog, HStack, Stack, Text } from "@chakra-ui/react";
import { useEffect, useRef, useState } from "react";
import { handleDialogAcceptShortcut } from "@/components/overlays/dialog-accept-shortcut";
import type { Param, ParamValueMap } from "@/components/param-editor/param-editor.types";
import { ParamEditorHorizontal } from "@/components/param-editor/param-editor-horizontal";
import { CreateFieldControl } from "./kanban-renderer-create-field";
import { getEnumOptions } from "./kanban-renderer-helpers";
import type {
  AttributeDescriptor,
  KanbanRendererCreateField,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
} from "./types";

interface KanbanRendererCreateDialogProps {
  open: boolean;
  columnId: string;
  columnAttributeId?: string;
  attributes: AttributeDescriptor[];
  config: KanbanRendererCreateRowConfig;
  onClose: () => void;
  onSubmit: (submission: KanbanRendererCreateSubmission) => Promise<void> | void;
}

const emptyValue = (field: KanbanRendererCreateField) => {
  if (field.type === "files" || field.type === "multi-select") return [];
  if (field.type === "boolean") return false;
  return "";
};

const initialFieldValues = (fields: KanbanRendererCreateField[]) =>
  Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? emptyValue(field)]));

const isFilled = (field: KanbanRendererCreateField, value: unknown) => {
  if (!field.required) return true;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
};

// Every editable attribute is offered, whatever its kind — narrowing to enums
// silently drops editable user/date/number attributes from the create form.
const editableCreateAttributes = (attributes: AttributeDescriptor[]) =>
  attributes.filter((attribute) => attribute.editable);

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

/**
 * Editable attributes render through the ParamEditor so a resource property and
 * a command param are the same control, not two that merely resemble each other.
 */
const attributeToParam = (attribute: AttributeDescriptor, locked: boolean): Param => {
  const base = { id: attribute.id, name: attribute.label, description: "" };

  if (attribute.type.kind === "enum" || attribute.type.kind === "enum-multi") {
    const multiSelect = attribute.type.kind === "enum-multi";
    return {
      ...base,
      type: "selection",
      defaultValue: multiSelect ? [] : "",
      multiSelect,
      // The trigger shows the value alone; the attribute name is the placeholder.
      placeholder: attribute.label,
      clearable: !locked,
      // The column already chose this value, and the create command reads it
      // from the column param — editing it here would be ignored.
      disabled: locked,
      options: getEnumOptions(attribute.type).map((option) => ({
        id: option.value,
        name: option.label,
        icon: option.icon ?? undefined,
        color: option.color,
      })),
    };
  }

  if (attribute.type.kind === "number") return { ...base, type: "number", defaultValue: 0 };
  return { ...base, type: "text", defaultValue: "", singleLine: true };
};

export const KanbanRendererCreateDialog = (props: KanbanRendererCreateDialogProps) => {
  const { open, columnId, columnAttributeId, attributes, config, onClose, onSubmit } = props;
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [attributeValues, setAttributeValues] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Uncontrolled editors (Lexical) read their seed once on mount, so a reset has
  // to remount the fields or the old text stays on screen over fresh state.
  const [resetToken, setResetToken] = useState(0);
  const initializedRef = useRef(false);
  const editableAttributes = editableCreateAttributes(attributes);

  // Opening is the only thing that clears the form. Attributes and fields can
  // arrive or change while it is open (they come from live sources), so this
  // runs once per open cycle — resetting on those would wipe what was typed.
  useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    setValues(initialFieldValues(config.fields));
    setAttributeValues(initialAttributeValues(editableCreateAttributes(attributes), columnAttributeId, columnId));
    setError("");
    setResetToken((token) => token + 1);
  }, [attributes, columnAttributeId, columnId, config.fields, open]);

  // Fields can be added or withdrawn while the dialog is open. Seed the new
  // ones and drop the withdrawn, so what is submitted always matches what is
  // rendered — but leave everything the user has already filled in alone.
  useEffect(() => {
    if (!open) return;
    const seeded = initialFieldValues(config.fields);
    const declared = new Set(config.fields.map((field) => field.id));
    setValues((current) => {
      const kept = Object.entries(current).filter(([id]) => declared.has(id));
      const added = Object.entries(seeded).filter(([id]) => !(id in current));
      if (added.length === 0 && kept.length === Object.keys(current).length) return current;
      return { ...Object.fromEntries(added), ...Object.fromEntries(kept) };
    });
  }, [config.fields, open]);

  // Same contract for attributes: seed the ones that appear after opening, drop
  // the ones withdrawn. A withdrawn entry left behind would still be submitted
  // even though its control is gone.
  useEffect(() => {
    if (!open) return;
    const editable = editableCreateAttributes(attributes);
    const seeded = initialAttributeValues(editable, columnAttributeId, columnId);
    const declared = new Set(editable.map((attribute) => attribute.id));
    setAttributeValues((current) => {
      const kept = Object.entries(current).filter(([id]) => declared.has(id));
      const added = Object.entries(seeded).filter(([id]) => !(id in current));
      if (added.length === 0 && kept.length === Object.keys(current).length) return current;
      return { ...Object.fromEntries(added), ...Object.fromEntries(kept) };
    });
  }, [attributes, open, columnId, columnAttributeId]);

  const close = () => {
    if (!submitting) onClose();
  };

  const valid = config.fields.every((field) => isFilled(field, values[field.id]));

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const fileFieldIds = new Set(config.fields.filter((field) => field.type === "files").map((field) => field.id));
      const files = [...fileFieldIds].flatMap((id) => (Array.isArray(values[id]) ? (values[id] as File[]) : []));
      const declaredValues = Object.fromEntries(Object.entries(values).filter(([id]) => !fileFieldIds.has(id)));

      await onSubmit({ columnId, columnAttributeId, values: declaredValues, attributeValues, files });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : config.labels.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} size="lg" scrollBehavior="inside" onOpenChange={(details) => !details.open && close()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxH="calc(100% - 48px)"
          onKeyDownCapture={(event) => handleDialogAcceptShortcut(event, () => void submit(), valid && !submitting)}
        >
          <Dialog.Header>
            <Text textStyle="heading/M/semibold">{config.title}</Text>
            <Dialog.CloseTrigger asChild>
              <CloseButton size="sm" disabled={submitting} />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="md">
              {config.fields.map((field) => (
                <CreateFieldControl
                  key={`${field.id}:${resetToken.toString()}`}
                  field={field}
                  removeLabel={config.labels.removeFile}
                  value={values[field.id]}
                  disabled={submitting}
                  onChange={(value) => setValues((current) => ({ ...current, [field.id]: value }))}
                />
              ))}
              {editableAttributes.length > 0 ? (
                <Stack gap="2xs">
                  <Text textStyle="label/S/medium">{config.labels.properties}</Text>
                  <ParamEditorHorizontal
                    variant="small"
                    params={editableAttributes.map((attribute) =>
                      attributeToParam(attribute, attribute.id === columnAttributeId),
                    )}
                    defaultValues={attributeValues as ParamValueMap}
                    readOnly={submitting}
                    onChange={(attributeId, value) =>
                      setAttributeValues((current) => ({ ...current, [attributeId]: value }))
                    }
                  />
                </Stack>
              ) : null}
              {error ? (
                <Text textStyle="paragraph/S/regular" color="fg.error">
                  {error}
                </Text>
              ) : null}
            </Stack>
          </Dialog.Body>
          <Dialog.Footer justifyContent="end">
            <HStack gap="2">
              <Button size="sm" variant="ghost" disabled={submitting} onClick={close}>
                {config.labels.cancel}
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
