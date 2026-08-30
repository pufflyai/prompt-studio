import { text } from "pstdio-extensions/workbench";
import type { Disposable, WorkbenchModeActivationContext, WorkbenchPanelRegion } from "../../core";
import { workbenchPanelRegions } from "../../core";
import type { WorkbenchCompositionRegistry } from "../contributions/composition-contributions";
import {
  createWorkbenchCompositionRegistry,
  listCompositionAddablePanels,
  reconcileCompositionLayout,
  toPanelPlacements,
} from "../contributions/composition-contributions";
import type { InternalRegisterWorkbenchExtensionContributionsInput } from "./workbench-extension-host-types";

// Resource kinds declare data only: their registration gives the palette and host
// surfaces a label and icon. Presentation belongs to pages; there is no per-kind
// presenter and no ambient open for extension resources.
export const registerResourceKinds = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  const disposables: Disposable[] = [];
  for (const kind of input.metadata.resourceKinds ?? []) {
    if (input.workbench.resources.getKind(kind.id)) continue;
    disposables.push(
      input.workbench.resources.registerKind({
        kind: kind.id,
        label: kind.label ? text(kind.label, kind.id) : kind.id,
        icon: kind.icon ?? "FileText",
      }),
    );
  }
  return disposables;
};

// Modes compose static views only: their placements are the default composition shown
// while no page is active, and the furniture that survives page switches.
export const registerComposition = (input: InternalRegisterWorkbenchExtensionContributionsInput) => {
  const registry = createWorkbenchCompositionRegistry();
  const disposables: Disposable[] = [];
  for (const panel of input.metadata.panels) {
    disposables.push(
      registry.registerPanelCapability({
        id: panel.id,
        extensionId: panel.extensionId,
        title: text(panel.title, panel.id),
        icon: panel.icon,
        show: toPanelPlacements(panel.show),
      }),
    );
  }
  for (const mode of input.metadata.modes) {
    disposables.push(
      registry.registerModeComposition({
        id: mode.modeId,
        extensionId: mode.extensionId,
        modePanels: mode.modePanels,
      }),
    );
  }
  return { registry, disposables };
};

export const registerModes = (
  input: InternalRegisterWorkbenchExtensionContributionsInput,
  registry: WorkbenchCompositionRegistry,
) =>
  input.metadata.modes.map((mode) => {
    const applyComposition = (ctx: WorkbenchModeActivationContext, seeding: boolean) => {
      reconcileCompositionLayout(
        { layout: ctx.layout, notifications: ctx.notifications },
        { registry, modeId: mode.modeId, resourceKind: undefined, seeding },
      );
      if (ctx.layout.getLayout().regions.side.widgets.length > 0) ctx.shell.setSidePanelPresentation("attached");
    };

    return input.workbench.modes.registerMode({
      id: mode.modeId,
      label: text(mode.label, mode.modeId),
      panels: mode.panelRegions,
      listAddablePanels: ({ layout }) =>
        listCompositionAddablePanels({
          registry,
          modeId: mode.modeId,
          layout,
          resourceKind: undefined,
        }).filter((panel): panel is typeof panel & { region: WorkbenchPanelRegion } =>
          workbenchPanelRegions.includes(panel.region as WorkbenchPanelRegion),
        ),
      activate: () => undefined,
      seed: (ctx: WorkbenchModeActivationContext) => applyComposition(ctx, true),
      reconcile: (ctx: WorkbenchModeActivationContext) => applyComposition(ctx, false),
    });
  });
