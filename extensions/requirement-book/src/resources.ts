import {
  defineCommand,
  defineCommandPaletteResource,
  definePage,
  defineResourceKind,
  l10n,
  params,
  workbenchModes,
} from "@pstdio/sdk/extensions";
import { bookMenu } from "./book-menu";
import { readIndex } from "./read-index";
import { changed } from "./records";
import { resourceEntries, resourceSpecs } from "./resource-catalog";

import { resourceTarget, ruleTarget } from "./targets";
export const resourceContributions = resourceSpecs.map((spec) => {
  const resolve = defineCommand({
    id: spec.id === "requirement" ? "resolve" : `resolve.${spec.id}`,
    title: l10n(`book.resolve.${spec.id}`, `Resolve ${spec.label.toLowerCase()}`),
    cli: true,
    params: { reference: params.text({ resolvedFrom: "resource" }) },
    async run(ctx, input) {
      const data = await readIndex(ctx);
      const entry = resourceEntries(data, spec.id).find((item) => item.id === (input.reference ?? ctx.resource?.id));
      return entry ? resourceTarget(spec.id, entry.id, entry.label, ctx.projectId).resource : null;
    },
  });
  const kind = defineResourceKind({
    id: spec.id,
    label: l10n(`book.resource.${spec.id}`, spec.label),
    icon: spec.icon,
    resolve: resolve.ref,
  });
  const page = definePage({
    id: spec.id,
    title: l10n(`book.resource.${spec.id}`, spec.label),
    icon: spec.icon,
    path: spec.id,
    mode: workbenchModes.project,
    parent: { kind: "page", id: "book" },
    resource: { kinds: [kind.ref] },
    main: { kind: "view", view: { kind: "view", id: "book" }, cardinality: "one", presentation: "page", tab: bookMenu },
    slots: [],
  });
  const search = defineCommandPaletteResource({
    id: spec.id === "requirement" ? "requirements" : spec.plural.toLowerCase(),
    title: l10n(`book.search.${spec.id}`, `Search ${spec.plural.toLowerCase()}`),
    resourceKind: kind.ref,
    refreshEvents: [changed],
    async query(ctx, input) {
      const data = await readIndex(ctx);
      const query = input.query?.trim().toLowerCase() ?? "";
      return {
        items: resourceEntries(data, spec.id)
          .filter((item) => `${item.id} ${item.label} ${item.text}`.toLowerCase().includes(query))
          .slice(0, input.limit)
          .map((item) => ({
            id: item.id,
            label: spec.id === "requirement" ? `${item.id} ${item.label}` : item.label,
            icon: spec.icon,
            target:
              spec.id === "requirement"
                ? ruleTarget(
                    item.id,
                    item.label,
                    ctx.projectId,
                    data.chapters.find((chapter) => chapter.id === item.chapter)!,
                  )
                : resourceTarget(spec.id, item.id, item.label, ctx.projectId),
          })),
      };
    },
  });
  return { kind, page, search, resolve };
});
