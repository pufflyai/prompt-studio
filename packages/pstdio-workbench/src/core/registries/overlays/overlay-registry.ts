import type { Disposable } from "../../shared/disposable";
import type { LayoutModel } from "../layout/layout-model";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchViewMenuRegistry } from "../view-menus/view-menu-registry";
import { registerWorkbenchViewPlacement, type WorkbenchPlacementPresentation } from "../views/view-placement";
import type { WorkbenchViewRegistry } from "../views/view-registry";

export interface WorkbenchOverlayContribution extends Omit<WorkbenchPlacementPresentation, "mountStrategy"> {
  id: string;
  viewId: string;
  closable?: boolean;
}

export interface OpenWorkbenchOverlayInput {
  resource?: ResourceRef;
  title?: string;
}

export interface WorkbenchOverlayRegistry {
  registerOverlay(overlay: WorkbenchOverlayContribution): Disposable;
  getOverlay(id: string): WorkbenchOverlayContribution | undefined;
  listOverlays(): WorkbenchOverlayContribution[];
  openOverlay(id: string, input?: OpenWorkbenchOverlayInput): string;
  closeOverlay(instanceId: string): void;
}

const overlayContributionId = (id: string) => `workbench.overlay.${encodeURIComponent(id)}`;

export const createWorkbenchOverlayRegistry = (input: {
  layout: LayoutModel;
  views: WorkbenchViewRegistry;
  viewMenus?: WorkbenchViewMenuRegistry;
}): WorkbenchOverlayRegistry => {
  const overlays = new Map<string, WorkbenchOverlayContribution>();
  const registrations = new Map<string, Disposable>();

  return {
    registerOverlay(overlay) {
      if (overlays.has(overlay.id)) throw new Error(`Overlay already registered: ${overlay.id}`);
      const record = { ...overlay };
      const registration = registerWorkbenchViewPlacement(
        input.layout,
        input.views,
        {
          ...record,
          id: overlayContributionId(record.id),
          region: "overlay",
          role: "content",
          singleton: true,
          closable: record.closable ?? true,
        },
        input.viewMenus,
      );
      overlays.set(record.id, record);
      registrations.set(record.id, registration);
      return {
        dispose() {
          if (overlays.get(record.id) !== record) return;
          overlays.delete(record.id);
          registrations.delete(record.id);
          registration.dispose();
        },
      };
    },

    getOverlay: (id) => overlays.get(id),

    listOverlays: () => [...overlays.values()].sort((left, right) => left.id.localeCompare(right.id)),

    openOverlay(id, openInput = {}) {
      if (!overlays.has(id)) throw new Error(`Unknown overlay: ${id}`);
      return input.layout.openPanel(overlayContributionId(id), {
        viewId: overlays.get(id)?.viewId,
        resource: openInput.resource,
        title: openInput.title,
        closable: overlays.get(id)?.closable ?? true,
        strategy: { kind: "persistent" },
      }).instanceId;
    },

    closeOverlay(instanceId) {
      input.layout.removeWidgetPlacement(instanceId);
    },
  };
};
