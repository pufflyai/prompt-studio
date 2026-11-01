import { Box } from "@chakra-ui/react";
import type { CanvasFrame, CanvasMeta } from "@pstdio/canvas";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TicketStatusSettingsPanel } from "./status-settings-panel";

const StatusSettingsStory = () => {
  const host: GuestHost = {
    extensionId: "pstdio.pstdio-planner",
    call: (async () => ({
      outcome: {
        ok: true,
        status: "success",
        value: {
          statuses: [
            { id: "backlog", label: "Backlog", color: "gray", sortOrder: 0, isDefault: true, actions: ["create"] },
            { id: "done", label: "Done", color: "green", sortOrder: 1, actions: ["archive_all"] },
          ],
        },
      },
    })) as GuestHost["call"],
    onEvent: () => () => {},
  };
  return (
    <ChakraProvider value={psTheme}>
      <QueryClientProvider client={new QueryClient()}>
        <Box h="600px">
          <TicketStatusSettingsPanel host={host} />
        </Box>
      </QueryClientProvider>
    </ChakraProvider>
  );
};
const meta: CanvasMeta<typeof StatusSettingsStory> = {
  title: "Extensions/Planner/Status settings",
  component: StatusSettingsStory,
};
export default meta;
type Story = CanvasFrame<typeof StatusSettingsStory>;
export const Default: Story = {
  id: "extensions-planner-status-settings--default",
};
