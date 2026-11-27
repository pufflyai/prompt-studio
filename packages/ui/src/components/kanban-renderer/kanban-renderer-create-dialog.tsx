import { Button, CloseButton, HStack, Stack, Text } from "@chakra-ui/react";
import type { ViewFilterGroup } from "@pstdio/sdk/extensions";
import { useEffect, useId, useRef, useState } from "react";
import { handleDialogAcceptShortcut } from "@/components/overlays/dialog-accept-shortcut";
import type { Param, ParamValueMap } from "@/components/param-editor/param-editor.types";
import { ParamEditorHorizontal } from "@/components/param-editor/param-editor-horizontal";
import { ScrollArea } from "@/components/primitives/scroll-area";
import { ScopedDialog as Dialog } from "@/utils/scoped-overlays";
import { UnresolvedSubmission, UnresolvedSubmissionError } from "../primitives/unresolved-submission";
import { useKanbanCreatePreference } from "./kanban-create-preference.store";
import { KanbanCreateSubmit } from "./kanban-create-submit";
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

const dropSavedFile = (values: Record<string, unknown>, file: File) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.filter((entry) => entry !== file) : value,
    ]),
  );

const splitCreateFields = (fields: KanbanRendererCreateRowConfig["fields"], values: Record<string, unknown>) => {
  const fileFieldIds = new Set(fields.filter((field) => field.type === "files").map((field) => field.id));
  return {
    files: [...fileFieldIds].flatMap((id) => (Array.isArray(values[id]) ? (values[id] as File[]) : [])),
    values: Object.fromEntries(Object.entries(values).filter(([id]) => !fileFieldIds.has(id))),
  };
};

const downloadDraftFile = (file: File) => {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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
  const { openCreatedRow, setOpenCreatedRow } = useKanbanCreatePreference();
  const unresolved = draft?.unresolved;
  const values = draft?.values ?? {};
  const attributeValues = draft?.attributeValues ?? {};
  const [submitting, setSubmitting] = useState(false);
  const waiting = submitting || Boolean(draft?.pending);
  const [error, setError] = useState("");
  const dismissPending = useRef<(() => void) | undefined>(undefined);
  const editableAttributes = editableCreateAttributes(attributes);
  const needsDraft = open && !draft;

  // Reopening restores the board's draft, including markdown and attachments.
  // Cancel and Escape must never reset it: only X and successful submission do.
  useEffect(() => {
    if (!needsDraft) return;
    setDraft(
      (current) =>
        current ?? {
          values: initialFieldValues(config.fields),
          attributeValues: getCreateAttributeValues(attributes, columnAttributeId, columnId, filter),
        },
    );
  }, [attributes, columnAttributeId, columnId, config.fields, filter, needsDraft, setDraft]);

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
    if (draft?.pending && dismissPending.current) return dismissPending.current();
    if (!submitting) onClose();
  };

  const discard = () => {
    if (waiting) return;
    clearDraft();
    onClose();
  };

  const valid = config.fields.every((field) => isFilled(field, values[field.id]));

  if (!draft) return null;
  const canSubmit = valid && !waiting && !unresolved;
  const shouldOpen = config.labels.submitWithoutOpening ? openCreatedRow : true;
  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    let closed = false;
    let dismissed = false;
    const closeAfterSubmit = () => {
      if (closed) return;
      closed = true;
      onClose();
    };
    dismissPending.current = () => {
      dismissed = true;
      closeAfterSubmit();
    };
    const pending = Symbol("create row");
    const updateSubmittedDraft = (result: (current: NonNullable<typeof draft>) => NonNullable<typeof draft> | null) =>
      setDraft((current) =>
        current && (current === draft || current.submission === pending) ? result(current) : current,
      );
    const submission = () => {
      return {
        columnId,
        columnAttributeId,
        ...splitCreateFields(config.fields, values),
        attributeValues,
        openCreatedRow: shouldOpen,
        canOpenCreatedRow: () => !dismissed,
        onAdmitted: () => {
          updateSubmittedDraft((current) => ({ ...current, pending: true, submission: pending }));
          if (!shouldOpen || !columnId) closeAfterSubmit();
        },
        onOpenSettled: closeAfterSubmit,
        onDiscard: () => updateSubmittedDraft(() => null),
        onSettled: (attachmentError?: unknown) =>
          updateSubmittedDraft((current) =>
            attachmentError instanceof UnresolvedSubmissionError
              ? { ...current, pending: false, unresolved: attachmentError }
              : null,
          ),
        onAttachmentSaved: (file: File) =>
          updateSubmittedDraft((current) => ({
            ...current,
            values: dropSavedFile(current.values, file),
          })),
      };
    };
    try {
      await onSubmit(submission());
      updateSubmittedDraft(() => null);
      closeAfterSubmit();
    } catch (caught) {
      const unresolved = caught instanceof UnresolvedSubmissionError ? caught : undefined;
      updateSubmittedDraft((current) => ({ ...current, pending: false, unresolved }));
      if (!unresolved && !closed) setError(caught instanceof Error ? caught.message : config.labels.submitError);
    } finally {
      dismissPending.current = undefined;
      if (!closed) setSubmitting(false);
    }
  };

  return (
    <Dialog.Root
      open={open}
      size="lg"
      variant="create"
      scrollBehavior="inside"
      closeOnInteractOutside={false}
      onOpenChange={(details) => !details.open && close()}
    >
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content onKeyDownCapture={(event) => handleDialogAcceptShortcut(event, () => void submit(), canSubmit)}>
          <Dialog.Header>
            <Dialog.Title>{config.title}</Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <CloseButton
                size="sm"
                disabled={waiting && !draft.pending}
                onClick={unresolved || draft.pending ? close : discard}
              />
            </Dialog.CloseTrigger>
          </Dialog.Header>
          <ScrollArea flex="1" minH="0" height="auto">
            <Dialog.Body>
              <Stack gap="md">
                {config.fields.map((field) => (
                  <CreateFieldControl
                    key={field.id}
                    field={field}
                    removeLabel={config.labels.removeFile}
                    value={values[field.id]}
                    disabled={waiting || Boolean(unresolved)}
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
                      readOnly={waiting || Boolean(unresolved)}
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
                {unresolved ? (
                  <>
                    <UnresolvedSubmission submission={unresolved} onClose={close} onDiscard={discard} />
                    {splitCreateFields(config.fields, values).files.map((file, index) => (
                      <Button
                        key={`${file.name}.${index}`}
                        size="xs"
                        variant="outline"
                        onClick={() => downloadDraftFile(file)}
                      >
                        Download {file.name}
                      </Button>
                    ))}
                  </>
                ) : null}
                {error ? (
                  <Text textStyle="paragraph/S/regular" color="fg.error">
                    {error}
                  </Text>
                ) : null}
              </Stack>
            </Dialog.Body>
          </ScrollArea>
          <Dialog.Footer justifyContent="end">
            <HStack gap="2">
              <Button size="sm" variant="ghost" disabled={submitting} onClick={close}>
                {config.labels.cancel}
              </Button>
              <KanbanCreateSubmit
                label={config.submitLabel}
                withoutOpeningLabel={config.labels.submitWithoutOpening}
                openCreatedRow={openCreatedRow}
                onChoose={setOpenCreatedRow}
                onSubmit={() => void submit()}
                disabled={!valid || Boolean(unresolved)}
                submitting={waiting}
              />
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
