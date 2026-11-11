import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import {
  type WorkbenchModuleContribution,
  workbenchCommandPaletteMenuPath,
  workbenchTopHeaderTrailingMenuPath,
} from "../../core";
import { registerRelatedResourcePreviews } from "./related-resource-previews";
import { RelatedResources } from "./related-resources";
import { closeResourceLinksOnProjectChange } from "./resource-links-project-scope";
import type { ResourceLinksService } from "./resource-links-types";

export interface WorkbenchResourceLinksOptions {
  canonicalize(resource: ResourceRef): ResourceRef | undefined;
  createService(resource: ResourceRef): ResourceLinksService;
}

export const resourceLinksCommandId = "workbench.resources.links";
const viewId = "workbench.resources.related";

export const createWorkbenchResourceLinksModule = (options: WorkbenchResourceLinksOptions) =>
  ({
    id: "workbench.resource-links",
    activate(ctx) {
      const previews = registerRelatedResourcePreviews(ctx, options);
      const currentResource = () => {
        const resource = ctx.getActiveResource() ?? ctx.getPrimaryResource();
        return resource && options.canonicalize(resource);
      };
      ctx.views.registerView({
        id: viewId,
        title: "Related resources",
        body: {
          kind: "react",
          render: (input) => {
            const resource = input.instance.resource;
            return resource ? (
              <RelatedResources
                key={`${resource.projectId}:${resource.extensionId}:${resource.type}:${resource.id}`}
                resource={resource}
                service={options.createService(resource)}
                onClose={() => ctx.overlays.closeOverlay(input.instance.instanceId)}
              />
            ) : null;
          },
        },
      });
      ctx.overlays.registerOverlay({
        id: viewId,
        viewId,
        config: { size: "md", placement: "center", scrollBehavior: "inside" },
      });
      ctx.commands.registerCommand(
        { id: resourceLinksCommandId, label: "Related resources", icon: "link", category: "Resources" },
        {
          isEnabled: () => Boolean(currentResource()),
          isVisible: (args) =>
            (args as { source?: string } | undefined)?.source === "session-header"
              ? currentResource()?.type === "session"
              : Boolean(currentResource()),
          execute: (args, context) => {
            const source = (args as { source?: string } | undefined)?.source;
            const fromActive = source === "active-resource" || source === "session-header";
            const current =
              (fromActive ? undefined : context?.resource) ?? ctx.getActiveResource() ?? ctx.getPrimaryResource();
            const resource = current && options.canonicalize(current);
            if (!resource) return;
            const existing = ctx.layout
              .getLayout()
              .regions.overlay.widgets.find(
                (widget) => widget.viewId === viewId && resourceKey(widget.resource) === resourceKey(resource),
              );
            if (existing && source === "session-header") ctx.overlays.closeOverlay(existing.widgetId);
            else ctx.overlays.openOverlay(viewId, { resource, title: "Related resources" });
          },
        },
      );
      ctx.layout.registerMenuItem(workbenchCommandPaletteMenuPath, {
        commandId: resourceLinksCommandId,
        args: { source: "active-resource" },
        group: "Resources",
      });
      ctx.layout.registerMenuItem(workbenchTopHeaderTrailingMenuPath, {
        commandId: resourceLinksCommandId,
        args: { source: "session-header" },
        // Keep the label visible without promoting a secondary action to the primary style.
        icon: "",
        group: "resources",
      });
      return [previews, closeResourceLinksOnProjectChange(ctx, viewId)];
    },
  }) satisfies WorkbenchModuleContribution;
