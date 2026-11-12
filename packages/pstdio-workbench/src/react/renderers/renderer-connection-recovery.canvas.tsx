import { Button, Stack, Text } from "@chakra-ui/react";
import { PstdioConnectionError } from "@pstdio/sdk/client";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchThemeProvider } from "../theme/workbench-theme-provider";
import { RendererReadNotice } from "./renderer-read-notice";
import { useRendererRead } from "./use-renderer-read";

const ConnectionRecovery = () => {
  const [workbench] = useState(() => createWorkbench());
  const [backend] = useState(() => ({ available: false }));
  const [attempts, setAttempts] = useState(0);
  const read = useRendererRead({
    workbench,
    ownerKey: "connection-recovery",
    queryKey: "connection-recovery",
    load: () => {
      setAttempts((count) => count + 1);
      if (!backend.available) throw new PstdioConnectionError(new TypeError("Failed to fetch"));
      return "Loaded content";
    },
    subscribe: () => () => {},
  });
  return (
    <WorkbenchThemeProvider>
      <Stack gap="md" p="md">
        <Text>Read attempts {attempts}</Text>
        <Button
          onClick={() => {
            backend.available = true;
          }}
        >
          Restore response
        </Button>
        {read.error ? <RendererReadNotice error={read.error} retry={read.retry} /> : null}
        {read.value ? <Text>{read.value}</Text> : null}
        {read.loading ? <Text>Loading</Text> : null}
      </Stack>
    </WorkbenchThemeProvider>
  );
};

export default {
  title: "Product/Workbench/Views/Connection recovery",
  component: ConnectionRecovery,
  description:
    "An initial page read waits quietly for the backend and retries automatically, even while live sync remains connected.",
};

export const InitialConnectionFailure = {};
