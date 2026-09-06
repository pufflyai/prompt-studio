import { Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "../../../core";

export const createPlaceholderWorkbench = () => {
  const workbench = createWorkbench();
  workbench.registerModule({
    id: "host.empty-state",
    activate(ctx) {
      ctx.views.registerView({
        id: "host.empty-state",
        title: "Empty main",
        body: {
          kind: "react",
          render: () => (
            <Stack h="full" align="center" justify="center" gap="xs" bg="bg">
              <Text textStyle="heading/M/semibold">Nothing is open</Text>
              <Text color="fg.muted">Open a tool to replace this placeholder.</Text>
            </Stack>
          ),
        },
      });
      ctx.placeholders.registerPlaceholder({
        id: "host.empty-state",
        viewId: "host.empty-state",
        region: "main",
      });
    },
  });
  return workbench;
};
