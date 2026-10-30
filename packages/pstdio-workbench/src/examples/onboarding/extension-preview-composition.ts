import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  NavigationTarget,
  NavigationTargetPage,
  PageContribution,
  PagePlaceholder,
  PlacementItem,
  PlacementPresentation,
} from "@pstdio/sdk/extensions";

const extensionId = "preview.guide";
export const previewRef = <Kind extends string>(ref: { extensionId?: string; kind: Kind; id: string }) => ({
  ...ref,
  extensionId: ref.extensionId ?? extensionId,
});
type MetadataTarget = WorkbenchExtensionMetadata["navigationItems"][number]["action"];
type MetadataPage = WorkbenchExtensionMetadata["pages"][number];
const pageTarget = (target: NavigationTargetPage): Extract<MetadataTarget, { kind: "page" }> => ({
  ...target,
  page: previewRef(target.page),
  parent: target.parent ? pageTarget(target.parent) : undefined,
});
export const previewNavigationTarget = (target: NavigationTarget): MetadataTarget => {
  if (target.kind === "page") return pageTarget(target);
  if (target.kind === "viewer") return { ...target, page: target.page ? previewRef(target.page) : undefined };
  if (target.kind === "panel")
    return {
      ...target,
      panel:
        target.panel.kind === "page-slot"
          ? { ...target.panel, page: previewRef(target.panel.page) }
          : previewRef(target.panel),
    };
  if (target.kind === "command")
    return { kind: "command", target: { ...target.target, command: previewRef(target.target.command) } };
  if (target.kind === "href") return target;
  return {
    kind: "compound",
    targets: target.targets.map((item) =>
      item.kind === "page"
        ? pageTarget(item)
        : {
            ...item,
            panel:
              item.panel.kind === "page-slot"
                ? { ...item.panel, page: previewRef(item.panel.page) }
                : previewRef(item.panel),
          },
    ),
  };
};
const previewItem = (item: PlacementItem): MetadataPage["slots"][number]["item"] =>
  item.kind === "view"
    ? { ...item, view: previewRef(item.view) }
    : {
        kind: "binding",
        binding: {
          ...item.binding,
          kinds: item.binding.kinds.map(previewRef),
          view: previewRef(item.binding.view),
          add: item.binding.add ? previewNavigationTarget(item.binding.add) : undefined,
        },
      };
const previewEmpty = (empty: PagePlaceholder | undefined) => {
  if (!empty) return undefined;
  if (!("view" in empty)) return previewRef(empty);
  return {
    ...empty,
    view: previewRef(empty.view),
    breadcrumb: empty.breadcrumb
      ? {
          ...empty.breadcrumb,
          menu: empty.breadcrumb.menu?.map((group) => ({
            ...group,
            rows: group.rows.map((row) => ({
              ...row,
              action: row.action ? previewNavigationTarget(row.action) : undefined,
            })),
          })),
        }
      : undefined,
  };
};
export const previewPage = (
  page: PageContribution,
  tab: (id: string, value: PlacementPresentation["tab"]) => MetadataPage["slots"][number]["tab"],
): MetadataPage => ({
  id: `${extensionId}.page.${page.id}`,
  localId: page.id,
  extensionId,
  title: page.title,
  icon: page.icon,
  path: page.path,
  regionSettings: page.regionSettings,
  mode: previewRef(page.mode),
  parent: page.parent ? previewRef(page.parent) : undefined,
  resource: page.resource ? { kinds: page.resource.kinds.map(previewRef) } : undefined,
  panelView: page.panelView ? previewRef(page.panelView) : undefined,
  main: previewMain(page.main, tab, page.id),
  slots: page.slots.map((slot) => ({
    ...slot,
    addableIn: slot.addableIn ? [...slot.addableIn] : undefined,
    movableTo: slot.movableTo ? [...slot.movableTo] : undefined,
    item: previewItem(slot.item),
    tab: tab(`${page.id}.${slot.id}`, slot.tab),
  })),
});
const previewMain = (
  main: PageContribution["main"],
  tab: (id: string, value: PlacementPresentation["tab"]) => MetadataPage["slots"][number]["tab"],
  pageId: string,
) => {
  if (main.kind === "group") return { ...main, default: previewRef(main.default) };
  return main.kind === "panels"
    ? {
        ...main,
        empty: previewEmpty(main.empty),
        landing: main.landing && typeof main.landing !== "string" ? previewRef(main.landing) : main.landing,
      }
    : {
        ...main,
        view: previewRef(main.view),
        empty: previewEmpty(main.empty),
        tab: tab(`${pageId}.$main`, main.tab),
      };
};
