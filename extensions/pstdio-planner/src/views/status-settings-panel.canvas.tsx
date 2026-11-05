import { Box } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import {
  applyEditingChanges,
  type GuestHost,
  type WebviewEditingSessionParams,
  type WebviewEditingSnapshot,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState } from "react";
import { PlannerCollectionEditor } from "./planner-collection-editor";

const StatusSettingsStory = () => {
  const [host] = useState(() => {
    let state: WebviewEditingSnapshot = { value: {}, version: 0, revision: 0, savedRevision: 0 };
    const host: GuestHost = {
      extensionId: "pstdio.pstdio-planner",
      call: (async (method, input) => {
        if (method === "commands.execute")
          return {
            outcome: {
              ok: true,
              status: "success",
              value: {
                statuses: [
                  {
                    id: "backlog",
                    label: "Backlog",
                    color: "gray",
                    sortOrder: 0,
                    isDefault: true,
                    actions: ["create"],
                  },
                  { id: "done", label: "Done", color: "green", sortOrder: 1, actions: ["archive_all"] },
                ],
              },
            },
          };
        if (method === "editing.session") {
          const request = input as WebviewEditingSessionParams;
          if (request.operation === "open") state = { ...state, value: request.initial };
          if (request.operation === "preview")
            state = { ...state, value: applyEditingChanges(state.value, request.changes), version: state.version + 1 };
          return state;
        }
      }) as GuestHost["call"],
      onEvent: () => () => {},
    };
    return host;
  });
  return (
    <ChakraProvider value={psTheme}>
      <Box h="600px">
        <PlannerCollectionEditor host={host} kind="status" />
      </Box>
    </ChakraProvider>
  );
};
export default { title: "Extensions/Planner/Status settings", component: StatusSettingsStory } satisfies CanvasMeta<
  typeof StatusSettingsStory
>;
export const Default = {};
