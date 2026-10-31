import { Box, Button, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { HostEventPublisher } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import { createWorkbench } from "../../core";
import { getBridgeWebviewHostEventPublisher } from "../../extensions/bridge/bridge-webview-renderer";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { Workbench } from "../workbench/workbench";
import { createWorkbenchSettingsModule, WORKBENCH_SETTINGS_OPEN_COMMAND_ID } from "./settings-module";

interface EventControlProps {
  title: string;
  events: HostEventPublisher;
}
const EventControl = (props: EventControlProps) => {
  const { title, events } = props;
  const [received, setReceived] = useState(0);
  useEffect(() => {
    events.bind(() => setReceived((count) => count + 1));
    return () => events.unbind();
  }, [events]);
  return (
    <Stack gap="xs">
      <Text>{`${title} received ${received}`}</Text>
      <Button size="sm" onClick={() => events.emit({ scope: "performance.read", payload: null })}>
        Send to {title}
      </Button>
    </Stack>
  );
};
const EmbeddedSettingsStory = () => {
  const [workbench] = useState(() => createWorkbench());
  useEffect(() => {
    const settings = workbench.registerModule(createWorkbenchSettingsModule());
    const controls = workbench.registerModule({
      id: "preview.settings.embedded",
      activate(ctx) {
        const children = ["First", "Second"].map((title) => {
          ctx.views.registerView({
            id: title,
            title,
            body: {
              kind: "react",
              render: (input) => (
                <EventControl
                  title={title}
                  events={getBridgeWebviewHostEventPublisher(input.workbench, input.instance)}
                />
              ),
            },
          });
          return ctx.settings.registerPanel({
            id: title,
            title,
            kind: "view",
            viewId: title,
            parentPanelId: "controls",
            scope: "global",
          });
        });
        ctx.views.registerView({
          id: "controls",
          title: "Embedded controls",
          body: {
            kind: "react",
            render: () => (
              <Button size="sm" onClick={() => children[0]!.dispose()}>
                Remove First
              </Button>
            ),
          },
        });
        ctx.settings.registerPanel({
          id: "controls",
          title: "Embedded controls",
          kind: "view",
          viewId: "controls",
          scope: "global",
        });
      },
    });
    void workbench.commands.executeCommand(WORKBENCH_SETTINGS_OPEN_COMMAND_ID);
    return () => {
      controls.dispose();
      settings.dispose();
    };
  }, [workbench]);
  return <Workbench workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Embedded settings",
  component: EmbeddedSettingsStory,
  decorators: [
    (Story) => (
      <WorkbenchThemeProvider>
        <Box height="100vh">
          <Story />
        </Box>
      </WorkbenchThemeProvider>
    ),
  ],
  fullscreen: true,
} satisfies CanvasMeta<typeof EmbeddedSettingsStory>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const IndependentEventsAndDisposal: Story = {
  id: "pstdio-workbench-reference-core-api-embedded-settings--independent-events-and-disposal",
};
