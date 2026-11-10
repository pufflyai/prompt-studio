import { Button, HStack, Stack } from "@chakra-ui/react";
import { createWorkbench, type TreeViewSection } from "@pstdio/workbench";
import { WorkbenchThemeProvider, WorkbenchTreeView } from "@pstdio/workbench/react";
import { type ComponentType, useEffect, useState } from "react";

// Import the public build so this preview exercises the production React compiler.
const createHistory = () => {
  const workbench = createWorkbench();
  const root = Promise.withResolvers<TreeViewSection[]>();
  const page = Promise.withResolvers<void>();
  let released = false;
  let paused = false;
  const sections = (): TreeViewSection[] => [
    {
      id: "history",
      nodes: Array.from({ length: 20 }, (_, index) => ({
        id: `session-${index}`,
        label: index === 0 ? `Account ${paused ? "paused" : "running"}` : `Session ${index + 1}`,
      })),
      nextPage: async (signal) => {
        await page.promise;
        signal.throwIfAborted();
        return { nodes: [{ id: "older", label: "Older session" }] };
      },
    },
  ];
  workbench.views.registerView({
    id: "compiled-history",
    title: "Compiled history",
    body: { kind: "tree", getBody: () => (released ? sections() : root.promise), getChildren: () => [] },
  });
  return {
    workbench,
    accept() {
      released = true;
      root.resolve(sections());
    },
    finish: () => page.resolve(),
    toggle() {
      paused = !paused;
      workbench.views.refreshView("compiled-history");
    },
    dispose() {
      root.resolve([]);
      page.resolve();
      void workbench.dispose();
    },
  };
};

const History = () => {
  const [history] = useState(createHistory);
  useEffect(() => () => history.dispose(), [history]);
  return (
    <Stack h="96" w="80" gap="xs">
      <HStack flexShrink="0">
        <Button onClick={() => history.accept()}>Accept history</Button>
        <Button onClick={() => history.finish()}>Finish page</Button>
        <Button onClick={() => history.toggle()}>Toggle account</Button>
      </HStack>
      <WorkbenchTreeView workbench={history.workbench} treeViewId="compiled-history" />
    </Stack>
  );
};

const meta = {
  title: "Product/Workbench/Navigation/Tree/Compiled history updates",
  component: History,
  description: "Accepted roots, continuation pages and refreshed rows through the public production build.",
  decorators: [
    (Story: ComponentType) => (
      <WorkbenchThemeProvider>
        <Story />
      </WorkbenchThemeProvider>
    ),
  ],
};
export default meta;
export const CompiledHistory = { id: "workbench-tree-compiled-history" };
