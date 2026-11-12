import {
  defineExtension,
  definePage,
  defineResourceKind,
  defineView,
  packageAsset,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { createDocumentLayoutPages } from "./document-layout";

const section = defineView({
  id: "section",
  title: "Section",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const optional = defineView({
  id: "optional",
  title: "Optional panel",
  body: { kind: "webview", entry: packageAsset("./view.ts", import.meta.url) },
});
const parent = definePage({
  id: "root",
  path: "root",
  title: "Documents",
  mode: workbenchModes.project,
  main: { kind: "view", view: section.ref, cardinality: "one" },
  slots: [],
});
const kind = defineResourceKind({ id: "document", label: "Document" });
export default defineExtension({
  resourceKinds: [kind],
  views: [section, optional],
  pages: [parent, ...createDocumentLayoutPages(parent.ref, kind.ref, section.ref, optional.ref)],
});
