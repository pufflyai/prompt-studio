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
    ctx.sessionPanel.setMode("attached");
    ctx.resources.registerKind({ kind: regionResourceKind, label: "Workbench region", icon: "SquareDashed" });

    ctx.renderers.registerRenderer({
      id: regionMapRendererId,
      render: ({ placement, workbench }) => {
        const region = resolvePlacementRegion(
          placement.resource?.metadata?.region,
          placement.resource?.id ?? placement.contributionId,
        );

        const placeholder = (
          <RegionMapPlaceholder
            region={region}
            role={describeSurface(region)}
            name={placement.resource?.label ?? placement.title ?? placement.contributionId}
            uri={placement.resource?.uri ?? "pstdio://region-map/unknown"}
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
                  workbench.layout.openWidget(regionWidgetId("overlay"), {
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
      ctx.layout.registerWidget({
        id: regionWidgetId(region),
        title: regionLabels[region],
        region,
        singleton: true,
        closable: region === "overlay",
        config: region === "overlay" ? overlayConfig : undefined,
        rendererId: regionMapRendererId,
      });

      if (region !== "overlay") {
        ctx.layout.openWidget(regionWidgetId(region), { resource: createRegionResource(region) });
      }
    }
  },
});
