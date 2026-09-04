import { Code, Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "../../../core";

export const createViewsWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule({
    id: "host.guide",
    activate(ctx) {
      // A View defines reusable content. Registering it opens nothing.
      ctx.views.registerView({
        id: "host.guide",
        title: "Guide",
        body: {
          kind: "react",
          render: ({ instance }) => (
            <Stack h="full" gap="sm" p="lg" bg="bg">
              <Text textStyle="heading/M/semibold">{instance.title}</Text>
              <Text color="fg.muted">A View owns this trusted React content.</Text>
              <Text color="fg.muted">
                The Instance details View to the right is registered once and placed twice. Close it in the Side Panel,
                then reopen it from that region's add menu. The Secondary Panel copy starts closed.
              </Text>
            </Stack>
          ),
        },
      });

      // One View can back many placements. Each visible instance gets its own
      // render input describing where it is mounted.
      ctx.views.registerView({
        id: "host.instance-info",
        title: "Instance details",
        body: {
          kind: "react",
          render: ({ instance }) => (
            <Stack h="full" gap="sm" p="lg" bg="bg">
              <Text textStyle="heading/S/semibold">{instance.title}</Text>
              <Text color="fg.muted">
                Placement owner: <Code>{instance.placementIdentity?.kind ?? "none"}</Code>
              </Text>
              <Text color="fg.muted">
                Instance key: <Code>{instance.placementIdentity?.instanceKey ?? "default"}</Code>
              </Text>
            </Stack>
          ),
        },
      });

      // Placements decide where a View appears and how it may open and close.
      ctx.shellPlacements.registerPlacement({
        id: "host.guide",
        item: { kind: "view", viewId: "host.guide", presence: "fixed" },
        region: "main",
      });
      ctx.shellPlacements.registerPlacement({
        id: "host.instance-info.side",
        item: { kind: "view", viewId: "host.instance-info", presence: "open" },
        region: "side",
      });
      ctx.shellPlacements.registerPlacement({
        id: "host.instance-info.secondary",
        item: { kind: "view", viewId: "host.instance-info", presence: "closed" },
        region: "secondary",
      });
    },
  });
  return workbench;
};
