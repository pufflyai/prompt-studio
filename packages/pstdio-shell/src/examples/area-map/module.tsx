import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { type ShellModuleContribution, shellAreas } from "../../core";
import type { ShellOverlayWidgetConfig } from "../../react";
import { AreaPlaceholder } from "./components/area-placeholder";
import {
  areaLabels,
  areaMapRendererId,
  areaResourceKind,
  areaWidgetId,
  bottomExtraWidgets,
  createAreaResource,
} from "./mock-data/areas";

const overlayConfig: ShellOverlayWidgetConfig = {
  closeOnInteractOutside: false,
};

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
      render: ({ placement, shell }) => {
        const area = resolvePlacementArea(
          placement.resource?.metadata?.area,
          placement.resource?.id ?? placement.contributionId,
        );

        const placeholder = (
          <AreaPlaceholder
            area={area}
            name={placement.resource?.label ?? placement.title ?? placement.contributionId}
            uri={placement.resource?.uri ?? "pstdio://area-map/unknown"}
          />
        );

        if (area === "overlay") {
          return (
            <Box position="relative" h="full" w="full">
              {placeholder}
            </Box>
          );
        }

        if (area !== "main") return placeholder;

        return (
          <Stack h="full" w="full" minH="0" minW="0" gap="0">
            <Box flex="1" minH="0">
              {placeholder}
            </Box>
            <HStack justifyContent="center" p="md">
              <Button
                size="sm"
                variant="subtle"
                onClick={() =>
                  shell.layout.openWidget(areaWidgetId("overlay"), {
                    resource: createAreaResource("overlay"),
                  })
                }
              >
                Show overlay
              </Button>
            </HStack>
          </Stack>
        );
      },
    });

    for (const area of shellAreas) {
      ctx.layout.registerWidget({
        id: areaWidgetId(area),
        title: areaLabels[area],
        area,
        singleton: true,
        closable: area === "overlay",
        config: area === "overlay" ? overlayConfig : undefined,
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
