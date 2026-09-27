import {
  defineCommandPaletteResource,
  defineExtension,
  defineNavigationItem,
  definePage,
  defineResourceKind,
  defineView,
  defineViewMenu,
  l10n,
  type NavigationTarget,
  packageAsset,
  workbenchModes,
  workbenchPages,
} from "@pstdio/sdk/extensions";
import { catalog, getItem } from "./catalog";
import { commands } from "./commands";
import { inspector } from "./inspector";

const itemKind = defineResourceKind({ id: "review-item", label: l10n("item.label", "Review item"), icon: "file" });
const preview = defineView({
  id: "preview",
  title: l10n("preview.title", "Preview"),
  body: {
    kind: "webview",
    entry: packageAsset("./preview-entry.tsx", import.meta.url),
    capabilities: ["commands.execute"],
  },
});
const page = definePage({
  id: "review",
  title: l10n("review.title", "Resource reviewer"),
  path: "review",
  mode: workbenchModes.project,
  parent: workbenchPages.start,
  resource: { kinds: [itemKind.ref] },
  main: { kind: "view", view: preview.ref, cardinality: "one" },
  slots: [],
});
const target = (id: string, projectId?: string) =>
  ({
    kind: "page",
    page: page.ref,
    resource: { type: itemKind.id, id, label: getItem(id).label, projectId },
  }) satisfies NavigationTarget;

const tree = defineView({
  id: "items",
  title: l10n("items.title", "Review items"),
  body: {
    kind: "tree",
    body: (_ctx, { renderer }) => [
      {
        id: "items",
        collapsible: false,
        nodes: catalog.map((item) => {
          const destination = target(item.id, renderer.projectId);
          return {
            id: item.id,
            label: item.label,
            icon: "file",
            resource: destination.resource,
            target: destination,
            selected: renderer.resource?.id === item.id,
          };
        }),
      },
    ],
  },
});

const palette = defineCommandPaletteResource({
  id: "items",
  title: l10n("search.title", "Review items"),
  resourceKind: itemKind.ref,
  query: (_ctx, input) => ({
    items: catalog
      .filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(input.query.toLowerCase()))
      .slice(0, input.limit)
      .map((item) => ({ id: item.id, label: item.label, icon: "file", target: target(item.id, input.projectId) })),
  }),
});

export default defineExtension({
  commands: Object.values(commands),
  resourceKinds: [itemKind],
  pages: [page],
  views: [preview, tree, inspector],
  viewMenus: [
    defineViewMenu({ id: "items", owner: preview.ref, view: tree.ref, side: "left" }),
    defineViewMenu({ id: "properties", owner: preview.ref, view: inspector.ref, side: "right" }),
  ],
  navigationItems: [
    defineNavigationItem({
      id: "reviewer",
      owner: workbenchModes.project,
      slot: "content",
      group: "Tools",
      label: l10n("reviewer.label", "Resource reviewer"),
      icon: "file",
      action: target(catalog[0].id),
    }),
  ],
  commandPaletteResources: [palette],
});
