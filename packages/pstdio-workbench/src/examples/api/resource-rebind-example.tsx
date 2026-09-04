import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import { createWorkbench, type ResourceRef, type WorkbenchCore } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const inspectorPlacementId = "guide.inspector";

const branches = {
  main: { kind: "branch", uri: "branch:main", id: "main", label: "main" },
  release: { kind: "branch", uri: "branch:release", id: "release", label: "release" },
} as const satisfies Record<string, ResourceRef>;

const inspectBranch = (workbench: WorkbenchCore, resource: ResourceRef) => {
  workbench.shellPlacements.openPlacement({
    placementId: inspectorPlacementId,
    resource,
    title: resource.label,
  });
};

const BranchLauncher = (props: { workbench: WorkbenchCore }) => {
  const { workbench } = props;

  return (
    <Stack gap="md" p="lg">
      <Text textStyle="heading/M">Branches</Text>
      <Text color="fg.muted">
        The inspector declares <code>cardinality: "one"</code>. Opening another branch rebinds the same instance instead
        of adding a tab.
      </Text>
      <HStack gap="sm" flexWrap="wrap">
        <Button size="sm" onClick={() => inspectBranch(workbench, branches.main)}>
          Inspect main
        </Button>
        <Button size="sm" onClick={() => inspectBranch(workbench, branches.release)}>
          Inspect release
        </Button>
      </HStack>
    </Stack>
  );
};

const createResourceRebindWorkbench = () => {
  const workbench = createWorkbench();

  workbench.views.registerView({
    id: "guide.branches",
    title: "Branches",
    body: {
      kind: "react",
      render: ({ workbench }) => <BranchLauncher workbench={workbench} />,
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "guide.branches",
    item: { kind: "view", viewId: "guide.branches", presence: "fixed" },
    region: "main",
  });
  workbench.views.registerView({
    id: "guide.branch-inspector",
    title: "Branch inspector",
    body: {
      kind: "react",
      render: ({ instance }) => (
        <Stack gap="sm" p="lg">
          <Text textStyle="heading/M">{instance.resource?.label}</Text>
          <Text color="fg.muted">Bound resource: {instance.resource?.uri}</Text>
        </Stack>
      ),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: inspectorPlacementId,
    item: {
      kind: "resource",
      viewId: "guide.branch-inspector",
      resourceKinds: ["branch"],
      cardinality: "one",
    },
    region: "secondary",
  });

  return workbench;
};

export const ResourceRebindExample = () => {
  const [workbench] = useState(createResourceRebindWorkbench);

  return (
    <WorkbenchThemeProvider>
      <Box h="480px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
