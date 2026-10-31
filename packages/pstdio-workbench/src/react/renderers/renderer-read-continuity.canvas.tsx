import { Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { TreeList, type TreeListSection } from "@pstdio/ui";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { useRendererRead } from "./use-renderer-read";

const sections: TreeListSection[] = [
  {
    id: "navigation",
    nodes: [
      { id: "ticket", label: "Ticket" },
      { id: "workspace", label: "Project folder" },
    ],
  },
];
const ProgressiveRead = () => {
  const [workbench] = useState(() => createWorkbench());
  const [scope, setScope] = useState(0);
  const [started, setStarted] = useState(0);
  const [pending] = useState(() => Promise.withResolvers<void>());
  const read = useRendererRead<TreeListSection[]>({
    workbench,
    ownerKey: "navigation",
    queryKey: "navigation",
    refreshKey: String(scope),
    load: async (signal, publish) => {
      publish([]);
      if (scope === 0) {
        await Promise.resolve();
        publish(sections);
        setStarted(1);
        await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
      } else {
        setStarted(2);
        signal.addEventListener("abort", () => pending.resolve(), { once: true });
        await pending.promise;
      }
      signal.throwIfAborted();
      return sections;
    },
    subscribe: () => () => {},
  });
  return (
    <WorkbenchThemeProvider>
      <Stack gap="md" p="md">
        <Text>Keep visible navigation while a replacement read is loading.</Text>
        <Button onClick={() => setScope(scope + 1)}>Refresh navigation</Button>
        <Button onClick={() => pending.resolve()}>Finish loading</Button>
        <Text>Read {started} started</Text>
        <Text>{read.loading ? "Loading" : "Ready"}</Text>
        <TreeList sections={read.value ?? []} expandedSectionIds={["navigation"]} />
      </Stack>
    </WorkbenchThemeProvider>
  );
};
const meta = {
  title: "pstdio-workbench/Guides/Progressive read continuity",
  component: ProgressiveRead,
  fullscreen: true,
} satisfies CanvasMeta<typeof ProgressiveRead>;
export default meta;
type Story = CanvasFrame<typeof meta>;
export const RefreshBeforeCompletion: Story = {
  id: "pstdio-workbench-guides-progressive-read-continuity--refresh-before-completion",
};
