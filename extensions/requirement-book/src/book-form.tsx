import { Button, CloseButton, Dialog, Field, HStack, Input, Portal, Stack, Text, Textarea } from "@chakra-ui/react";
import { ScrollArea } from "@pstdio/ui";
import type { KanbanRendererCreateRowConfig } from "@pstdio/ui/kanban-renderer";
import { useRef, useState } from "react";
import { submitBookForm } from "./book-form-submission";
import { BookSelect } from "./book-select";
import type { Draft } from "./records";

interface FormProps {
  title: string;
  fields: NonNullable<KanbanRendererCreateRowConfig["fields"]>;
  submitLabel: string;
  draft?: Draft;
  submissionStatus?: Draft["submissionStatus"];
  draftRevision?: string;
  canDiscardSubmission: boolean;
  onSubmit: (values: Record<string, unknown>, expectedRevision: string) => Promise<void>;
  onClose: () => void;
  onSaveDraft: (values: Record<string, unknown>, expectedRevision: string) => Promise<string>;
  onDiscard: (expectedRevision: string) => Promise<void>;
  onCheckSubmission?: () => Promise<boolean>;
}
const submissionMessage = {
  confirmed: "This submission was saved.",
  writing: "Saving this submission…",
  unconfirmed: "Check the book for this submission before discarding its draft.",
};
export function BookForm(props: FormProps) {
  const {
    title,
    fields,
    submitLabel,
    draft,
    submissionStatus,
    canDiscardSubmission,
    draftRevision,
    onSubmit,
    onClose,
    onSaveDraft,
    onDiscard,
    onCheckSubmission,
  } = props;
  const submissionUnconfirmed = submissionStatus !== undefined;
  const [input, setValues] = useState<Record<string, unknown>>();
  const editedRevision = useRef<string | undefined>(undefined);
  const changeValues = (next: Record<string, unknown>) => {
    editedRevision.current ??= draftRevision;
    setValues(next);
  };
  const expectedRevision = () => {
    const observed = editedRevision.current ?? draftRevision;
    if (observed === undefined) throw new Error("The draft is still opening.");
    return observed;
  };
  const values = (!submissionUnconfirmed && input) || {
    ...Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? ""])),
    ...draft?.values,
  };
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const queue = useRef(Promise.resolve());
  const persist = (next: Record<string, unknown>) => {
    queue.current = queue.current
      .catch(() => {})
      .then(async () => {
        editedRevision.current = await onSaveDraft(next, expectedRevision());
      });
    return queue.current;
  };
  const close = async () => {
    if (saving) return;
    if (submissionUnconfirmed || input === undefined) return onClose();
    setSaving(true);
    try {
      await persist(values);
      onClose();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setSaving(false);
    }
  };
  const submit = async () => {
    if (
      saving ||
      submissionUnconfirmed ||
      fields.some((field) => field.required && !String(values[field.id] ?? "").trim())
    )
      return;
    setSaving(true);
    setError("");
    try {
      await submitBookForm({
        persist: () => persist(values),
        submit: () => onSubmit(values, expectedRevision()),
        close: onClose,
      });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  const discard = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await queue.current.catch(() => {});
      await onDiscard(submissionStatus && draftRevision !== undefined ? draftRevision : expectedRevision());
      onClose();
    } catch (failure) {
      setError(String(failure));
    } finally {
      setSaving(false);
    }
  };
  const check = async () => {
    setSaving(true);
    setError("");
    try {
      if (!(await onCheckSubmission?.())) setError("The submission is still unconfirmed.");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setSaving(false);
    }
  };
  const valid = fields.every((field) => !field.required || String(values[field.id] ?? "").trim());
  return (
    <Dialog.Root
      open
      onOpenChange={(details) => {
        if (!details.open) void close();
      }}
    >
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
            }}
          >
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.CloseTrigger asChild>
              <CloseButton
                size="sm"
                disabled={saving || !canDiscardSubmission}
                aria-label="Discard draft"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void discard();
                }}
              />
            </Dialog.CloseTrigger>
            <ScrollArea maxH="60vh">
              <Dialog.Body>
                <Stack gap="md">
                  {fields.map((field) => (
                    <Field.Root key={field.id} required={field.required}>
                      <Field.Label>{field.label}</Field.Label>
                      {field.type === "select" && (
                        <BookSelect
                          field={field}
                          value={values[field.id]}
                          onChange={(value) => {
                            const next = { ...values, [field.id]: value };
                            if (saving || submissionUnconfirmed || draftRevision === undefined) return;
                            changeValues(next);
                            void persist(next).catch((failure) => setError(String(failure)));
                          }}
                        />
                      )}
                      {field.type === "longtext" && (
                        <Textarea
                          value={String(values[field.id] ?? "")}
                          disabled={saving || submissionUnconfirmed || draftRevision === undefined}
                          onChange={(event) => changeValues({ ...values, [field.id]: event.target.value })}
                          onBlur={() => {
                            if (saving || submissionUnconfirmed || draftRevision === undefined) return;
                            void persist(values).catch((failure) => setError(String(failure)));
                          }}
                        />
                      )}
                      {field.type !== "select" && field.type !== "longtext" && (
                        <Input
                          autoFocus={field === fields[0]}
                          value={String(values[field.id] ?? "")}
                          placeholder={field.placeholder}
                          disabled={saving || submissionUnconfirmed || draftRevision === undefined}
                          onChange={(event) => changeValues({ ...values, [field.id]: event.target.value })}
                          onBlur={() => {
                            if (saving || submissionUnconfirmed || draftRevision === undefined) return;
                            void persist(values).catch((failure) => setError(String(failure)));
                          }}
                        />
                      )}
                    </Field.Root>
                  ))}
                  {submissionUnconfirmed && !saving ? (
                    <Text role="status" color="fg.muted" textStyle="paragraph/S/regular">
                      {submissionMessage[submissionStatus]}
                    </Text>
                  ) : null}
                  {error && (
                    <Text role="alert" color="fg.error" textStyle="paragraph/S/regular">
                      {error}
                    </Text>
                  )}
                </Stack>
              </Dialog.Body>
            </ScrollArea>
            <Dialog.Footer>
              <HStack gap="sm">
                <Button variant="ghost" disabled={saving} onClick={() => void close()}>
                  Cancel
                </Button>
                {onCheckSubmission && submissionStatus !== "confirmed" ? (
                  <Button disabled={saving} onClick={() => void check()}>
                    Check again
                  </Button>
                ) : null}
                <Button
                  variant="solid"
                  disabled={!valid || saving || submissionUnconfirmed || draftRevision === undefined}
                  onClick={() => void submit()}
                >
                  {saving ? "Saving…" : submitLabel}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
