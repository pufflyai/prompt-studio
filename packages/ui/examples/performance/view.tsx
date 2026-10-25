import "@pstdio/ui/style.css";
import { Button, Text } from "@chakra-ui/react";
import { createWebviewClient, defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

export default defineExtensionView({
  render({ mount, host }) {
    const client = createWebviewClient(host);
    const lease = client.performance.retain();
    const Control = () => {
      const [enabled, setEnabled] = useState(false);
      const [error, setError] = useState<string>();
      const [snapshotHost, setSnapshotHost] = useState<string>();
      useEffect(() => {
        let active = true;
        void client.performance.state().then((state) => {
          if (active) setEnabled(state.enabled);
        });
        return () => {
          active = false;
        };
      }, []);
      const toggle = async () => {
        try {
          await client.performance.setEnabled(!enabled);
          const state = await client.performance.state();
          setEnabled(state.enabled);
          setSnapshotHost((await client.performance.snapshot())?.host);
          setError(undefined);
        } catch (error) {
          setError(String(error));
        }
      };
      return (
        <>
          <Button size="sm" onClick={() => void toggle()}>
            {enabled ? "Stop example capture" : "Start example capture"}
          </Button>
          {snapshotHost ? <Text textStyle="paragraph/S/regular">Snapshot: {snapshotHost}</Text> : null}
          {error ? <p role="alert">{error}</p> : null}
        </>
      );
    };
    const root = createRoot(mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <Control />
      </ChakraProvider>,
    );
    return () => {
      root.unmount();
      void lease.then((release) => release()).catch(() => {});
    };
  },
});
