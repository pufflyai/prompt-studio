import { Button, Stack } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createWorkbench, type Disposable } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { WorkbenchNavChrome } from "./workbench-nav-chrome";

const OpenTabPresence = () => {
  const first = useRef<Disposable | undefined>(undefined);
  const second = useRef<Disposable | undefined>(undefined);
  const [fixture] = useState(() => {
    const workbench = createWorkbench();
    const alex = { id: "device-a", label: "Alex" };
    const sam = { id: "device-b", label: "Sam" };
    let participants = [alex, sam];
    const listeners = new Set<() => void>();
    return {
      workbench,
      first: { getParticipants: () => [alex], subscribe: () => () => {} },
      second: {
        getParticipants: () => participants,
        subscribe: (listener: () => void) => {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
      },
      disconnect: () => {
        participants = [];
        for (const listener of listeners) listener();
      },
    };
  });
  useEffect(() => {
    first.current = fixture.workbench.presence.register(fixture.first);
    second.current = fixture.workbench.presence.register(fixture.second);
    return () => {
      first.current?.dispose();
      second.current?.dispose();
    };
  }, [fixture]);
  return (
    <WorkbenchThemeProvider>
      <Stack>
        <WorkbenchNavChrome workbench={fixture.workbench} hasNav={false} panelControls={false} />
        <Button onClick={() => first.current?.dispose()}>Close first tab</Button>
        <Button onClick={fixture.disconnect}>Disconnect second tab</Button>
      </Stack>
    </WorkbenchThemeProvider>
  );
};

const meta = {
  title: "pstdio-workbench/Guides/Header presence",
  component: OpenTabPresence,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof OpenTabPresence>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AcrossOpenTabs: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const nav = canvasElement.querySelector<HTMLElement>('[data-workbench-region="nav"]')!;
    const header = within(nav);
    await waitFor(() => expect(header.getAllByRole("listitem", { name: "Alex" })).toHaveLength(1));
    await expect(header.getByRole("listitem", { name: "Sam" })).toBeVisible();
    const presence = header.getByRole("list", { name: "Other editors" });
    await expect(presence.getBoundingClientRect().left).toBeGreaterThan(nav.getBoundingClientRect().width / 2);
    await userEvent.click(canvas.getByRole("button", { name: "Close first tab" }));
    await expect(header.getByRole("listitem", { name: "Alex" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Disconnect second tab" }));
    await waitFor(() => expect(header.queryByRole("list", { name: "Other editors" })).not.toBeInTheDocument());
  },
};
