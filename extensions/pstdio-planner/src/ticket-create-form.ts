import { type Localizable, l10n } from "@pstdio/sdk/extensions";
import type { KanbanRendererCreateRowConfig } from "@pstdio/ui/kanban-renderer";
export const ticketCreateForm = {
  title: l10n("kanbanRenderers.tickets.createRow.title", "New ticket"),
  submitLabel: l10n("kanbanRenderers.tickets.createRow.submitLabel", "Create ticket"),
  params: {
    content: {
      type: "markdown",
      label: l10n("kanbanRenderers.tickets.createRow.content.label", "Description"),
      placeholder: l10n("kanbanRenderers.tickets.createRow.content.placeholder", "Describe the ticket..."),
      required: true,
    },
    files: {
      type: "files",
      label: l10n("kanbanRenderers.tickets.createRow.attachments.label", "Attach files"),
      multiple: true,
    },
  },
  labels: {
    cancel: l10n("kanbanRenderers.tickets.createRow.cancel", "Cancel"),
    properties: l10n("kanbanRenderers.tickets.createRow.properties", "Properties"),
    submitError: l10n("kanbanRenderers.tickets.createRow.submitError", "Could not create ticket"),
    removeFile: l10n("kanbanRenderers.tickets.createRow.removeFile", "Remove file"),
  },
} as const;
export const localizeTicketFormValue = (value: Localizable, t: (key: string, fallback?: string) => string) =>
  typeof value === "string" ? value : t(value.$l10n, value.default);
export const createTicketFormConfig = (t: (key: string, fallback?: string) => string) =>
  ({
    title: localizeTicketFormValue(ticketCreateForm.title, t),
    submitLabel: localizeTicketFormValue(ticketCreateForm.submitLabel, t),
    fields: Object.entries(ticketCreateForm.params).map(([id, field]) => ({
      type: field.type,
      ...("required" in field ? { required: field.required } : {}),
      ...("multiple" in field ? { multiple: field.multiple } : {}),
      id,
      label: localizeTicketFormValue(field.label, t),
      ...("placeholder" in field ? { placeholder: localizeTicketFormValue(field.placeholder, t) } : {}),
    })),
    labels: {
      cancel: localizeTicketFormValue(ticketCreateForm.labels.cancel, t),
      properties: localizeTicketFormValue(ticketCreateForm.labels.properties, t),
      submitError: localizeTicketFormValue(ticketCreateForm.labels.submitError, t),
      removeFile: localizeTicketFormValue(ticketCreateForm.labels.removeFile, t),
    },
  }) satisfies KanbanRendererCreateRowConfig;
