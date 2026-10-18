import { definePage, type PageRef, type ResourceKindRef, type ViewRef, workbenchModes } from "@pstdio/sdk/extensions";

export const createDocumentLayoutPages = (
  parent: PageRef,
  kind: ResourceKindRef,
  empty: ViewRef,
  optional: ViewRef,
) => [
  definePage({
    id: "document-layout",
    title: "Document layout",
    path: "document-layout",
    parent,
    mode: workbenchModes.project,
    resource: { kinds: [kind] },
    document: { metadataKey: "document" },
    main: { kind: "panels", empty },
    slots: [{ id: "optional", region: "main", item: { kind: "view", view: optional, presence: "open" } }],
  }),
  definePage({
    id: "document-preview",
    title: "Document preview",
    path: "document-preview",
    parent,
    mode: workbenchModes.project,
    resource: { kinds: [kind] },
    document: { metadataKey: "document" },
    main: { kind: "view", view: optional, cardinality: "many" },
    slots: [],
  }),
];
