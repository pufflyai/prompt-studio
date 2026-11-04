import { Button, Stack } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import { useEffect, useRef, useState } from "react";

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
  fullscreen: true,
} satisfies CanvasMeta<typeof OpenTabPresence>;
export default meta;
type Story = CanvasFrame<typeof meta>;

export const AcrossOpenTabs: Story = {
  id: "pstdio-workbench-guides-header-presence--across-open-tabs",
};
