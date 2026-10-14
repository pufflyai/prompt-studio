import { Button, HStack, Text } from "@chakra-ui/react";
import type { WorkbenchCore } from "../../core";
import { WorkbenchBreadcrumbView, WorkbenchIcon } from "../../react";

export const registerWindowingProjectHeader = (workbench: WorkbenchCore) => {
  workbench.views.registerView({
    id: "windowing.project-header",
    title: "Project navigation",
    body: {
      kind: "react",
      render: () => (
        <HStack gap="xs" h="full" minW="0">
          <Button
            size="xs"
            variant="ghost"
            flexShrink={0}
            onClick={() => workbench.pageLocations.navigateToRootLevel()}
          >
            <WorkbenchIcon name="Folder" /> Windowing project
          </Button>
          <Text color="fg.subtle" aria-hidden="true">
            /
          </Text>
          <WorkbenchBreadcrumbView workbench={workbench} />
        </HStack>
      ),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "windowing.project-header",
    region: "nav",
    item: { kind: "view", presence: "fixed", view: { kind: "view", id: "windowing.project-header" } },
  });
};
