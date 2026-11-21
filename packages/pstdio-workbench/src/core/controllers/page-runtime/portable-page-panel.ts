import { contributionRefId } from "@pstdio/sdk/extensions";
import type { WorkbenchModePlacementRegistry } from "../../registries/modes/mode-placement-registry";
import { isSingleViewPage } from "../../registries/pages/page-main";
import type { WorkbenchPageContribution } from "../../registries/pages/page-registry";
import { createDisposable } from "../../shared/disposable";

const generatedRef = (page: WorkbenchPageContribution) => ({
  kind: "placement" as const,
  extensionId: "pstdio.workbench",
  id: `page/${encodeURIComponent(page.ref.extensionId!)}/${encodeURIComponent(page.ref.id)}`,
});

export const portablePagePanel = (page: WorkbenchPageContribution, registry: WorkbenchModePlacementRegistry) => {
  if (page.main.kind !== "view" || (!isSingleViewPage(page) && !page.resource)) return page.panelView;
  const declared = page.panelView && registry.getPlacement(page.panelView);
  const item = declared?.item;
  const compatible =
    item &&
    contributionRefId(item.kind === "view" ? item.view : item.binding.view) === contributionRefId(page.main.view) &&
    (page.resource
      ? item.kind === "binding" &&
        item.binding.cardinality === "many" &&
        page.resource.kinds.every((kind) =>
          item.binding.kinds.some((candidate) => contributionRefId(kind) === contributionRefId(candidate)),
        )
      : item.kind === "view");
  return compatible ? page.panelView : generatedRef(page);
};

const registerMainPagePanel = (page: WorkbenchPageContribution, registry: WorkbenchModePlacementRegistry) => {
  if (page.main.kind !== "view" || (!isSingleViewPage(page) && !page.resource)) return;
  const ref = portablePagePanel(page, registry)!;
  if (registry.getPlacement(ref)) return;
  const {
    view,
    cardinality: _cardinality,
    presentation: _presentation,
    kind: _kind,
    empty: _empty,
    ...metadata
  } = page.main;
  return registry.registerPlacement({
    ...metadata,
    id: `workbench.portable.${page.id}`,
    ref,
    modeId: page.modeId,
    region: "side",
    addableIn: [],
    item: page.resource
      ? { kind: "binding", binding: { ...page.resource, view, cardinality: "many" } }
      : { kind: "view", view, presence: "closed" },
  });
};

export const portablePageSlotPanel = (page: WorkbenchPageContribution, slotId: string) => ({
  ...generatedRef(page),
  id: `${generatedRef(page).id}/slot/${encodeURIComponent(slotId)}`,
});

export const registerPortablePagePanel = (
  page: WorkbenchPageContribution,
  registry: WorkbenchModePlacementRegistry,
) => {
  const main = registerMainPagePanel(page, registry);
  const registrations = main ? [main] : [];
  const dispose = () => {
    for (const registration of registrations.reverse()) registration.dispose();
  };
  try {
    for (const slot of page.slots) {
      if (page.resource && slot.region === "main" && slot.item.kind === "view") {
        registrations.push(
          registry.registerPlacement({
            ...slot,
            id: `workbench.portable.${page.id}.${encodeURIComponent(slot.id)}`,
            ref: portablePageSlotPanel(page, slot.id),
            modeId: page.modeId,
            addableIn: [],
            item: { kind: "binding", binding: { ...page.resource, view: slot.item.view, cardinality: "many" } },
          }),
        );
        continue;
      }
      if (slot.item.kind !== "binding" || slot.openOn === "page-resource") continue;
      registrations.push(
        registry.registerPlacement({
          ...slot,
          id: `workbench.portable.${page.id}.${encodeURIComponent(slot.id)}`,
          ref: portablePageSlotPanel(page, slot.id),
          modeId: page.modeId,
          addableIn: [],
          item: { kind: "binding", binding: { ...slot.item.binding, cardinality: "many" } },
        }),
      );
    }
  } catch (error) {
    dispose();
    throw error;
  }
  return createDisposable(dispose);
};
