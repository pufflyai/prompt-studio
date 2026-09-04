import { Button, Code, HStack, Stack, Text } from "@chakra-ui/react";
import { createWorkbench, type ResourceRef } from "../../../core";

const guidePlacementId = "host.resource-guide";
const openNextGuideCommandId = "host.resource-guide.open-next";

const guides = [
  { kind: "guide", uri: "guide:getting-started", id: "getting-started", label: "Getting started" },
  { kind: "guide", uri: "guide:views", id: "views", label: "Views and placements" },
  { kind: "guide", uri: "guide:resources", id: "resources", label: "Resource identity" },
] as const satisfies readonly ResourceRef[];

export const createResourceWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule({
    id: "host.resource-guide",
    activate(ctx) {
      let nextGuideIndex = 1;
      const openGuide = (resource: ResourceRef) =>
        ctx.shellPlacements.openPlacement({
          placementId: guidePlacementId,
          resource,
          title: resource.label,
          open: "pin",
        });

      ctx.resources.registerKind({ kind: "guide", label: "Guide", icon: "BookOpen" });
      ctx.views.registerView({
        id: guidePlacementId,
        title: "Open another guide",
        body: {
          kind: "react",
          render: ({ instance }) => (
            <Stack h="full" gap="sm" p="lg" bg="bg">
              <Text textStyle="heading/M/semibold">{instance.resource?.label}</Text>
              <Text color="fg.muted">
                Each button sends a different resource to the same placement. Reopening a guide selects its existing
                tab.
              </Text>
              <Code alignSelf="flex-start">{instance.resource?.uri}</Code>
              <HStack gap="sm" flexWrap="wrap" pt="sm">
                {guides.map((guide) => (
                  <Button key={guide.uri} size="sm" variant="outline" onClick={() => openGuide(guide)}>
                    Open {guide.label}
                  </Button>
                ))}
              </HStack>
              <Text color="fg.muted" textStyle="paragraph/XS/regular">
                The + menu in this tab bar runs the same open action.
              </Text>
            </Stack>
          ),
        },
      });
      ctx.commands.registerCommand(
        {
          id: openNextGuideCommandId,
          label: "Open another guide",
          category: "Guides",
          icon: "BookOpen",
        },
        {
          execute: () => {
            const guide = guides[nextGuideIndex % guides.length]!;
            nextGuideIndex += 1;
            return openGuide(guide);
          },
        },
      );
      ctx.shellPlacements.registerPlacement({
        id: guidePlacementId,
        item: {
          kind: "resource",
          viewId: guidePlacementId,
          resourceKinds: ["guide"],
          cardinality: "many",
          add: { kind: "command", commandId: openNextGuideCommandId },
        },
        region: "main",
      });
      openGuide(guides[0]);
    },
  });
  return workbench;
};
