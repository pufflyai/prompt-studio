import { type ShellModuleContribution, shellAreas } from "../../core";
import { AreaPlaceholder } from "./components/area-placeholder";
import {
  areaLabels,
  areaMapRendererId,
  areaResourceKind,
  areaWidgetId,
  bottomExtraWidgets,
  createAreaResource,
} from "./mock-data/areas";

const isShellArea = (value: unknown): value is (typeof shellAreas)[number] =>
  typeof value === "string" && (shellAreas as readonly string[]).includes(value);

const resolvePlacementArea = (value: unknown, fallback: string) => {
  if (isShellArea(value)) return value;
  if (isShellArea(fallback)) return fallback;
  return "main";
};

export const createAreaMapModule = (): ShellModuleContribution => ({
  id: "area-map",
  activate(ctx) {
    ctx.sessionPanel.setMode("attached");
    ctx.resources.registerKind({ kind: areaResourceKind, label: "Shell area", icon: "SquareDashed" });

    ctx.renderers.registerRenderer({
      id: areaMapRendererId,
      render: ({ placement }) => {
        const area = resolvePlacementArea(
          placement.resource?.metadata?.area,
          placement.resource?.id ?? placement.contributionId,
        );

        return (
          <AreaPlaceholder
            area={area}
            name={placement.resource?.label ?? placement.title ?? placement.contributionId}
            uri={placement.resource?.uri ?? "pstdio://area-map/unknown"}
          />
        );
      },
    });

    for (const area of shellAreas) {
      ctx.layout.registerWidget({
        id: areaWidgetId(area),
        title: areaLabels[area],
        area,
        singleton: true,
        rendererId: areaMapRendererId,
      });

      ctx.layout.openWidget(areaWidgetId(area), { resource: createAreaResource(area) });
    }

    for (const widget of bottomExtraWidgets) {
      ctx.layout.registerWidget({
        id: `area-map.${widget.id}`,
        title: widget.label,
        area: "main-bottom",
        singleton: true,
        rendererId: areaMapRendererId,
      });
      ctx.layout.openWidget(`area-map.${widget.id}`, {
        resource: createAreaResource("main-bottom", {
          id: widget.id,
          uri: `pstdio://area-map/main-bottom/${widget.id}`,
          label: widget.label,
        }),
      });
    }
  },
});
