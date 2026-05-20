import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Workbench } from "pstdio-workbench/react";
import { useState } from "react";
import { createDashboardWorkbench } from "./create-dashboard-workbench";

// Renders the workbench-first dashboard shell. Without a sync provider the
// surfaces show their empty states, so the story focuses on the shell chrome:
// navigation tree, breadcrumbs, areas, status bar, and the session panel.
const DashboardWorkbenchShell = () => {
  const [workbench] = useState(() => createDashboardWorkbench("storybook-project"));
  return (
    <Box h="100dvh" w="100%" overflow="hidden">
      <Workbench workbench={workbench} />
    </Box>
  );
};

const meta = {
  title: "Dashboard Workbench/Shell",
} satisfies Meta;

export default meta;

export const Shell: StoryObj = {
  render: () => <DashboardWorkbenchShell />,
};
