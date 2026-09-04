import { Box, Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const createTabPresentationWorkbench = () => {
  const workbench = createWorkbench();

  workbench.views.registerView({
    id: "guide.session",
    title: "Session",
    icon: "MessageCircle",
    body: {
      kind: "react",
      render: () => (
        <Stack gap="sm" p="lg">
          <Text textStyle="heading/M">Session tab</Text>
          <Text color="fg.muted">
            The status indicator replaces the ordinary view icon, so the tab has one leading glyph.
          </Text>
        </Stack>
      ),
    },
  });
  workbench.shellPlacements.registerPlacement({
    id: "guide.session",
    item: { kind: "view", viewId: "guide.session", presence: "fixed" },
    region: "main",
    tab: {
      getSnapshot: () => ({
        indicator: { icon: "CircleDot", color: "fg.warning", label: "Session status: awaiting input" },
      }),
    },
  });

  return workbench;
};

export const TabPresentationExample = () => {
  const [workbench] = useState(createTabPresentationWorkbench);

  return (
    <WorkbenchThemeProvider>
      <Box h="320px" minH="240px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
