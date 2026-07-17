import { Button, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import type { WorkbenchModuleContribution } from "../../core";
import { useWorkbenchClaim } from "../../react";

const primaryWidgetId = "keep-alive.two-placement.primary";
const primaryRendererId = "keep-alive.two-placement.primary-renderer";
const placementRendererId = "keep-alive.two-placement.shared-renderer";
const placementIds = ["keep-alive.two-placement.left", "keep-alive.two-placement.side"] as const;

const PrimaryPanel = () => (
  <Stack h="full" justifyContent="center" p="lg">
    <Text textStyle="title/S/semibold">Two simultaneous keep-alive placements</Text>
    <Text textStyle="paragraph/M/regular" color="fg.muted">
      The left and side counters use one renderer id but own independent mounted state.
    </Text>
  </Stack>
);

const PlacementCounter = () => {
  const claim = useWorkbenchClaim();
  const [count, setCount] = useState(0);
  if (!claim) return null;

  return (
    <Stack h="full" justifyContent="center" p="md">
      <Text textStyle="label/S/medium">{claim.placement.title}</Text>
      <Text textStyle="paragraph/S/regular" color="fg.muted">
        Count: {count}
      </Text>
      <Button alignSelf="start" size="sm" onClick={() => setCount((current) => current + 1)}>
        Increment
      </Button>
    </Stack>
  );
};

export const createTwoPlacementKeepAliveModule = (): WorkbenchModuleContribution => ({
  id: "keep-alive.two-placement",
  activate(ctx) {
    ctx.renderers.registerRenderer({ id: primaryRendererId, render: () => <PrimaryPanel /> });
    ctx.renderers.registerRenderer({ id: placementRendererId, keepAlive: true, render: () => <PlacementCounter /> });
    ctx.layout.registerWidget({
      id: primaryWidgetId,
      title: "Keep-alive placements",
      area: "main",
      rendererId: primaryRendererId,
    });
    ctx.layout.registerWidget({
      id: placementIds[0],
      title: "Left placement",
      area: "main",
      menu: { host: primaryWidgetId, side: "left", icon: "PanelLeft" },
      rendererId: placementRendererId,
    });
    ctx.layout.registerWidget({
      id: placementIds[1],
      title: "Side placement",
      area: "side",
      rendererId: placementRendererId,
    });

    ctx.layout.openWidget(primaryWidgetId, {
      resource: { kind: "keep-alive-example", uri: "pstdio://keep-alive/two-placement", label: "Keep alive" },
    });
    ctx.layout.openWidget(placementIds[0]);
    ctx.layout.openWidget(placementIds[1]);
    ctx.layout.setAreaPresentation("side", "docked");
  },
});
