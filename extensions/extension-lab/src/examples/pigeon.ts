import {
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  workbenchModes,
} from "@pstdio/sdk/extensions";

const message = defineResourceKind({ id: "pigeon-message", label: "Message" });
const pageRef = { kind: "page" as const, id: "pigeon" };
const messages = [
  { id: "hello", subject: "Hello from Pigeon", content: "Your first message." },
  { id: "meeting", subject: "Friday meeting", content: "Meet at ten on Friday." },
];
const inbox = defineView({
  id: "pigeon-inbox",
  title: "Inbox",
  body: {
    kind: "dataTable",
    columns: [{ id: "subject", label: "Subject" }],
    query: async () => ({
      rows: messages.map((item) => ({
        id: item.id,
        values: { subject: item.subject },
        resource: { type: message.id, id: item.id, label: item.subject },
      })),
    }),
    onRowActivate: async (_ctx, { row }) => ({ kind: "page", page: pageRef, resource: row.resource }),
  },
});
const reader = defineView({
  id: "pigeon-reader",
  title: "Message reader",
  body: {
    kind: "file",
    load: async (_ctx, { renderer }) => ({
      fileName: "message.md",
      content: `# ${renderer.resource!.label}\n\n${messages.find((item) => item.id === renderer.resource!.id)?.content ?? ""}`,
    }),
  },
});
export const pigeonPage = definePage({
  id: pageRef.id,
  title: "Pigeon",
  path: "pigeon",
  mode: workbenchModes.project,
  slots: [
    {
      id: "inbox",
      role: "primary",
      region: "main",
      view: inbox.ref,
      binding: { kind: message.ref, view: inbox.ref, cardinality: "one" },
    },
    {
      id: "reader",
      role: "auxiliary",
      region: "side",
      openOn: "page-resource",
      binding: { kind: message.ref, view: reader.ref, cardinality: "one" },
    },
  ],
});
export default defineExtension({
  resourceKinds: [message],
  views: [inbox, reader],
  pages: [pigeonPage],
  navigationItems: [
    defineNavigationItem({
      id: "pigeon",
      label: "Pigeon",
      icon: "Mail",
      owner: workbenchModes.project,
      slot: "content",
      action: { kind: "page", page: pigeonPage.ref },
    }),
  ],
});
