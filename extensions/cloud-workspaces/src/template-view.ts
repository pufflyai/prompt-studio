import { definePage, defineView, workbenchModes } from "@pstdio/sdk/extensions";
import { catalogPageRef } from "./lab-navigation";
import { templateKind } from "./resources";
import { catalogFiles, templateDocument } from "./template-catalog";

export const templateFileView = defineView({
  id: "template-file",
  title: "Agent template",
  icon: "package",
  body: {
    kind: "file",
    async load(ctx, { renderer }) {
      const path = renderer.resource?.id;
      if (!path) return { emptyState: { title: "Choose a template" } };
      return { ...(await templateDocument(catalogFiles(ctx), path)), textRenderer: "monaco" as const };
    },
  },
});

export const templatePage = definePage({
  id: "template",
  title: "Agent template",
  icon: "package",
  path: "pocketcoder-template",
  mode: workbenchModes.project,
  parent: catalogPageRef,
  resource: { kinds: [templateKind.ref] },
  main: { kind: "view", view: templateFileView.ref, cardinality: "one" },
  slots: [],
});
