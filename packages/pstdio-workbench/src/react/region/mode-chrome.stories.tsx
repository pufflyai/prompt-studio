import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { ModeChromeView } from "./mode-chrome";

const Counter = (props: { title: string }) => {
  const { title } = props;
  const [count, setCount] = useState(0);
  return (
    <Stack p="md" gap="sm">
      <Text>{title}</Text>
      <Button onClick={() => setCount(count + 1)}>Count: {count}</Button>
    </Stack>
  );
};

const RetainedModeViews = () => {
  const [example] = useState(() => {
    const workbench = createWorkbench();
    const first = workbench.views.registerView({
      id: "first",
      title: "First view",
      body: { kind: "react", render: () => <Counter title="First view" /> },
    });
    workbench.views.registerView({
      id: "second",
      title: "Second view",
      body: { kind: "react", render: () => <Counter title="Second view" /> },
    });
    return { workbench, first };
  });
  const [viewId, setViewId] = useState<string | undefined>("first");
  return (
    <WorkbenchThemeProvider>
      <Stack p="md" gap="md">
        <Text>Increment a counter, switch views or hide them, then return. Each count stays unchanged.</Text>
        <HStack gap="sm">
          <Button onClick={() => setViewId("first")}>First view</Button>
          <Button onClick={() => setViewId("second")}>Second view</Button>
          <Button onClick={() => setViewId(undefined)}>Hide views</Button>
          <Button
            onClick={() => {
              setViewId(undefined);
              example.first.dispose();
            }}
          >
            Remove first view
          </Button>
        </HStack>
        <Box h="xs" layerStyle="panel">
          <ModeChromeView workbench={example.workbench} viewId={viewId} region="nav" />
        </Box>
      </Stack>
    </WorkbenchThemeProvider>
  );
};

export default {
  title: "pstdio-workbench/Workbench/Mode view retention",
  render: () => <RetainedModeViews />,
} satisfies Meta;

export const NavigateAndReturn: StoryObj = {};
