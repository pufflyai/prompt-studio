import { Button, Stack, Text } from "@chakra-ui/react";
import { TreeList, type TreeListSection } from "@pstdio/ui";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  tags: ["!manifest"],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof ProgressiveRead>;
export default meta;
type Story = StoryObj<typeof meta>;

export const RefreshBeforeCompletion: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const ticket = await canvas.findByRole("option", { name: /^Ticket$/ });
    const workspace = canvas.getByRole("option", { name: /^Project folder$/ });
    await userEvent.click(canvas.getByRole("button", { name: "Refresh navigation" }));
    await canvas.findByText("Read 2 started");
    await expect(ticket).toBeVisible();
    await expect(workspace).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Finish loading" }));
    await canvas.findByText("Ready");
    await expect(ticket).toBeVisible();
    await expect(workspace).toBeVisible();
  },
};
