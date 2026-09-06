import type { WorkbenchExtensionMetadata } from "@pstdio/sdk/api";
import type {
  NavigationTarget,
  NavigationTargetPage,
  PageContribution,
  PlacementItem,
  PlacementPresentation,
} from "@pstdio/sdk/extensions";

const extensionId = "storybook.guide";
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
  mode: previewRef(page.mode),
  parent: page.parent ? previewRef(page.parent) : undefined,
  resource: page.resource ? { kinds: page.resource.kinds.map(previewRef) } : undefined,
  main:
    page.main.kind === "panels"
      ? { ...page.main, empty: previewRef(page.main.empty) }
      : { ...page.main, view: previewRef(page.main.view), tab: tab(`${page.id}.$main`, page.main.tab) },
  slots: page.slots.map((slot) => ({
    ...slot,
    item: previewItem(slot.item),
    tab: tab(`${page.id}.${slot.id}`, slot.tab),
  })),
});
