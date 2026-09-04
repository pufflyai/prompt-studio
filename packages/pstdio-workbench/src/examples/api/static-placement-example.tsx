import { Box, Button, Code, Stack, Text } from "@chakra-ui/react";
import { createWorkbench, type WorkbenchPanelRenderInput } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const placementId = "guide.static-placement";

const openPlacement = (workbench: WorkbenchPanelRenderInput["workbench"]) =>
  workbench.navigation.openPanel({ panel: { kind: "shell-placement", id: placementId } });

const StaticPlacement = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const currentKey = input.instance.placementIdentity?.instanceKey ?? "default";
  const [openCount, setOpenCount] = useState(1);

  return (
    <Stack gap="md" p="lg">
      <Text textStyle="heading/M">Static placement</Text>
      <Text color="fg.muted">A static placement has one instance. Opening it again selects that instance.</Text>
      <Button
        alignSelf="flex-start"
        size="sm"
        onClick={() => {
          void openPlacement(input.workbench);
          setOpenCount((count) => count + 1);
        }}
      >
        Open again
      </Button>
      <Text>
        Instance key: <Code>{currentKey}</Code>
      </Text>
      <Text>
        Open calls handled by this one instance: <Code>{openCount}</Code>
      </Text>
    </Stack>
  );
};

const createStaticPlacementWorkbench = () => {
  const workbench = createWorkbench();

  workbench.views.registerView({
    id: "guide.static-view",
    title: "Static placement",
    body: {
      kind: "react",
      render: (input) => <StaticPlacement input={input} />,
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: placementId,
    item: { kind: "view", viewId: "guide.static-view", presence: "closed" },
    region: "main",
  });
  void openPlacement(workbench);

  return workbench;
};

export const StaticPlacementExample = () => {
  const [workbench] = useState(createStaticPlacementWorkbench);

  return (
    <WorkbenchThemeProvider>
      <Box h="480px" minH="360px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
