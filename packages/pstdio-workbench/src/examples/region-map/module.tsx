import { Box, Button, HStack, Stack } from "@chakra-ui/react";
import { type WorkbenchModuleContribution, workbenchRegions } from "../../core";
import type { WorkbenchOverlayWidgetConfig } from "../../react";
import { RegionMapPlaceholder } from "./components/region-map-placeholder";
import {
  createRegionResource,
  describeSurface,
  regionLabels,
  regionMapRendererId,
  regionResourceKind,
  regionWidgetId,
} from "./mock-data/regions";

const overlayConfig: WorkbenchOverlayWidgetConfig = {
  closeOnInteractOutside: false,
  modal: false,
};

const isWorkbenchRegion = (value: unknown): value is (typeof workbenchRegions)[number] =>
  typeof value === "string" && (workbenchRegions as readonly string[]).includes(value);

const resolvePlacementRegion = (value: unknown, fallback: string) => {
  if (isWorkbenchRegion(value)) return value;
  if (isWorkbenchRegion(fallback)) return fallback;
  return "main";
};

export const createRegionMapModule = (): WorkbenchModuleContribution => ({
  id: "region-map",
  activate(ctx) {
    ctx.sidePanel.setMode("attached");
    ctx.resources.registerKind({ kind: regionResourceKind, label: "Workbench region", icon: "SquareDashed" });

    ctx.renderers.registerRenderer({
      id: regionMapRendererId,
      render: ({ instance, workbench }) => {
        const region = resolvePlacementRegion(
          instance.resource?.metadata?.region,
          instance.resource?.id ?? instance.panelId,
        );

        const placeholder = (
          <RegionMapPlaceholder
            region={region}
            role={describeSurface(region)}
            name={instance.resource?.label ?? instance.title ?? instance.panelId}
            uri={instance.resource?.uri ?? "pstdio://region-map/unknown"}
          />
        );

        if (region === "overlay") {
          return (
            <Box position="relative" h="full" w="full">
              {placeholder}
            </Box>
          );
        }

        if (region !== "main") return placeholder;

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
                  workbench.layout.openPanel(regionWidgetId("overlay"), {
                    resource: createRegionResource("overlay"),
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

    for (const region of workbenchRegions) {
      ctx.layout.registerPanel({
        id: regionWidgetId(region),
        title: regionLabels[region],
        region,
        singleton: true,
        config: region === "overlay" ? overlayConfig : undefined,
        rendererId: regionMapRendererId,
      });

      if (region !== "overlay") {
        ctx.layout.openPanel(regionWidgetId(region), { resource: createRegionResource(region) });
      }
    }
  },
});
