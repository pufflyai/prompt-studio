import { type ShellCore, shellAreas } from "../../core";
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

const registerAreaMapRenderers = (shell: ShellCore) => {
  shell.renderers.registerRenderer({
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
};

export const activateAreaMapExample = (shell: ShellCore) => {
  shell.sessionPanel.setMode("attached");
  shell.resources.registerKind({ kind: areaResourceKind, label: "Shell area", icon: "SquareDashed" });

  for (const area of shellAreas) {
    shell.layout.registerWidget({
      id: areaWidgetId(area),
      title: areaLabels[area],
      area,
      singleton: true,
      renderer: "react",
      rendererId: areaMapRendererId,
    });

    shell.layout.openWidget(areaWidgetId(area), { resource: createAreaResource(area) });
  }

  for (const widget of bottomExtraWidgets) {
    shell.layout.registerWidget({
      id: `area-map.${widget.id}`,
      title: widget.label,
      area: "main-bottom",
      singleton: true,
      renderer: "react",
      rendererId: areaMapRendererId,
    });
    shell.layout.openWidget(`area-map.${widget.id}`, {
      resource: createAreaResource("main-bottom", {
        id: widget.id,
        uri: `pstdio://area-map/main-bottom/${widget.id}`,
        label: widget.label,
      }),
    });
  }

  registerAreaMapRenderers(shell);
};
