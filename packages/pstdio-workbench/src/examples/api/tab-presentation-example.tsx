import { Box, Button, Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useState } from "react";

const createTabPresentationWorkbench = () => {
  const workbench = createWorkbench();
  const listeners = new Set<() => void>();
  let running = false;
  const toggle = () => {
    running = !running;
    for (const listener of listeners) listener();
  };
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
    item: {
      kind: "view",
      presence: "fixed",
      view: {
        kind: "view",
        id: "guide.session",
      },
    },
    region: "main",
    tab: {
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      getSnapshot: () => ({
        indicator: running
          ? { icon: "LoaderCircle", color: "fg.info", label: "Session status: in_progress" }
          : { icon: "CircleCheck", color: "fg.success", label: "Session status: completed" },
      }),
    },
  });
  return { workbench, toggle };
};
export const TabPresentationExample = () => {
  const [{ workbench, toggle }] = useState(createTabPresentationWorkbench);
  return (
    <WorkbenchThemeProvider>
      <Button onClick={toggle}>Change session status</Button>
      <Box h="320px" minH="240px" borderWidth="1px" borderColor="border.subtle" overflow="hidden">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};
