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
  canDiscardSubmission: boolean;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
  onSaveDraft: (values: Record<string, unknown>) => Promise<void>;
  onDiscard: () => Promise<void>;
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
    onSubmit,
    onClose,
    onSaveDraft,
    onDiscard,
  } = props;
  const submissionUnconfirmed = submissionStatus !== undefined;
  const [input, setValues] = useState<Record<string, unknown>>();
  const values = (!submissionUnconfirmed && input) || {
    ...Object.fromEntries(fields.map((field) => [field.id, field.defaultValue ?? ""])),
    ...draft?.values,
  };
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const queue = useRef(Promise.resolve());
  const persist = (next: Record<string, unknown>) => {
    queue.current = queue.current.catch(() => {}).then(() => onSaveDraft(next));
    return queue.current;
  };
  const close = async () => {
    if (saving) return;
    if (submissionUnconfirmed) return onClose();
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
        submit: () => onSubmit(values),
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
      await onDiscard();
      onClose();
    } catch (failure) {
      setError(String(failure));
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
                            if (saving || submissionUnconfirmed) return;
                            setValues(next);
                            void persist(next).catch((failure) => setError(String(failure)));
                          }}
                        />
                      )}
                      {field.type === "longtext" && (
                        <Textarea
                          value={String(values[field.id] ?? "")}
                          disabled={saving || submissionUnconfirmed}
                          onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
                          onBlur={() => {
                            if (saving || submissionUnconfirmed) return;
                            void persist(values).catch((failure) => setError(String(failure)));
                          }}
                        />
                      )}
                      {field.type !== "select" && field.type !== "longtext" && (
                        <Input
                          autoFocus={field === fields[0]}
                          value={String(values[field.id] ?? "")}
                          placeholder={field.placeholder}
                          disabled={saving || submissionUnconfirmed}
                          onChange={(event) => setValues({ ...values, [field.id]: event.target.value })}
                          onBlur={() => {
                            if (saving || submissionUnconfirmed) return;
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
                <Button
                  variant="solid"
                  disabled={!valid || saving || submissionUnconfirmed}
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
