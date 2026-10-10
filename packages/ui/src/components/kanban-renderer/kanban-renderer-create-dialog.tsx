import {
  Button,
  ButtonGroup,
  CloseButton,
  Dialog,
  HStack,
  Icon,
  IconButton,
  Menu,
  Stack,
  Text,
} from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { handleDialogAcceptShortcut } from "@/components/overlays/dialog-accept-shortcut";
import type { Param, ParamValueMap } from "@/components/param-editor/param-editor.types";
import { ParamEditorHorizontal } from "@/components/param-editor/param-editor-horizontal";
import { CreateFieldControl } from "./kanban-renderer-create-field";
import { getCreateAttributeValues } from "./kanban-renderer-create-values";
import { getEnumOptions } from "./kanban-renderer-helpers";
import type {
  AttributeDescriptor,
  KanbanRendererCreateField,
  KanbanRendererCreateRowConfig,
  KanbanRendererCreateSubmission,
} from "./types";
import { useKanbanCreateDraft } from "./use-kanban-create-draft";

interface KanbanRendererCreateDialogProps {
  open: boolean;
  columnId: string;
  columnAttributeId?: string;
  attributes: AttributeDescriptor[];
  config: KanbanRendererCreateRowConfig;
  draftKey?: string;
  filter?: ViewFilterGroup;
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
  const { open, columnId, columnAttributeId, attributes, config, draftKey, filter, onClose, onSubmit } = props;
  const localKey = useId();
  const { draft, setDraft, clearDraft } = useKanbanCreateDraft(draftKey ?? localKey);
  const values = draft?.values ?? {};
  const attributeValues = draft?.attributeValues ?? {};
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const editableAttributes = editableCreateAttributes(attributes);

  // Reopening restores the board's draft, including markdown and attachments.
  // Cancel and Escape must never reset it: only X and successful submission do.
  useEffect(() => {
    if (!open) return;
    setDraft(
      (current) =>
        current ?? {
          values: initialFieldValues(config.fields),
          attributeValues: getCreateAttributeValues(attributes, columnAttributeId, columnId, filter),
        },
    );
  }, [attributes, columnAttributeId, columnId, config.fields, filter, open, setDraft]);

  useEffect(() => {
    if (open) setError("");
  }, [open]);

  // Fields can be added or withdrawn while the dialog is open. Seed the new
  // ones and drop the withdrawn, so what is submitted always matches what is
  // rendered — but leave everything the user has already filled in alone.
  useEffect(() => {
    if (!open) return;
    const seeded = initialFieldValues(config.fields);
    const declared = new Set(config.fields.map((field) => field.id));
    setDraft((current) => {
      if (!current) return current;
      const kept = Object.entries(current.values).filter(([id]) => declared.has(id));
      const added = Object.entries(seeded).filter(([id]) => !(id in current.values));
      if (added.length === 0 && kept.length === Object.keys(current.values).length) return current;
      return { ...current, values: { ...Object.fromEntries(added), ...Object.fromEntries(kept) } };
    });
  }, [config.fields, open, setDraft]);

  // Same contract for attributes: seed the ones that appear after opening, drop
  // the ones withdrawn. A withdrawn entry left behind would still be submitted
  // even though its control is gone.
  useEffect(() => {
    if (!open) return;
    const editable = editableCreateAttributes(attributes);
    const seeded = getCreateAttributeValues(editable, columnAttributeId, columnId, filter);
    const declared = new Set(editable.map((attribute) => attribute.id));
    setDraft((current) => {
      if (!current) return current;
      const kept = Object.entries(current.attributeValues).filter(([id]) => declared.has(id));
      const added = Object.entries(seeded).filter(([id]) => !(id in current.attributeValues));
      const columnChanged = columnAttributeId && current.attributeValues[columnAttributeId] !== columnId;
      if (added.length === 0 && kept.length === Object.keys(current.attributeValues).length && !columnChanged)
        return current;
      return {
        ...current,
        attributeValues: {
          ...Object.fromEntries(added),
          ...Object.fromEntries(kept),
          ...(columnAttributeId ? { [columnAttributeId]: columnId } : {}),
        },
      };
    });
  }, [attributes, open, columnId, columnAttributeId, filter, setDraft]);

  const close = () => {
    if (!submitting) onClose();
  };

  const discard = () => {
    if (submitting) return;
    clearDraft();
    onClose();
  };

  const valid = config.fields.every((field) => isFilled(field, values[field.id]));

  const submit = async (openCreatedRow = true) => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const fileFieldIds = new Set(config.fields.filter((field) => field.type === "files").map((field) => field.id));
      const files = [...fileFieldIds].flatMap((id) => (Array.isArray(values[id]) ? (values[id] as File[]) : []));
      const declaredValues = Object.fromEntries(Object.entries(values).filter(([id]) => !fileFieldIds.has(id)));

      await onSubmit({ columnId, columnAttributeId, values: declaredValues, attributeValues, files, openCreatedRow });
      clearDraft();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : config.labels.submitError);
    } finally {
      setSubmitting(false);
    }
  };

  if (!draft) return null;

  return (
    <Dialog.Root
      open={open}
      size="lg"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={(details) => !details.open && close()}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          maxH="calc(100% - 48px)"
          onKeyDownCapture={(event) => handleDialogAcceptShortcut(event, () => void submit(), valid && !submitting)}
        >
          <Dialog.Header>
            <Dialog.Title>{config.title}</Dialog.Title>
            <CloseButton size="sm" disabled={submitting} onClick={discard} />
          </Dialog.Header>
          <Dialog.Body>
            <Stack gap="md">
              {config.fields.map((field) => (
                <CreateFieldControl
                  key={field.id}
                  field={field}
                  removeLabel={config.labels.removeFile}
                  value={values[field.id]}
                  disabled={submitting}
                  onChange={(value) =>
                    setDraft((current) => current && { ...current, values: { ...current.values, [field.id]: value } })
                  }
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
                      setDraft(
                        (current) =>
                          current && {
                            ...current,
                            attributeValues: { ...current.attributeValues, [attributeId]: value },
                          },
                      )
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
              <ButtonGroup size="sm" variant="primary" attached>
                <Button disabled={!valid} loading={submitting} onClick={() => void submit()}>
                  {config.submitLabel}
                </Button>
                {config.labels.submitWithoutOpening ? (
                  <Menu.Root positioning={{ placement: "top-end" }}>
                    <Menu.Trigger asChild>
                      <IconButton aria-label={config.labels.submitWithoutOpening} disabled={!valid || submitting}>
                        <Icon as={ChevronDown} />
                      </IconButton>
                    </Menu.Trigger>
                    <Menu.Positioner>
                      <Menu.Content>
                        <Menu.Item value="create" onSelect={() => void submit()}>
                          {config.submitLabel}
                        </Menu.Item>
                        <Menu.Item value="create-without-opening" onSelect={() => void submit(false)}>
                          {config.labels.submitWithoutOpening}
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Menu.Root>
                ) : null}
              </ButtonGroup>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
