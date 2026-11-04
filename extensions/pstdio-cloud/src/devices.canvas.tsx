import "@pstdio/ui/style.css";
import type { CloudDevice } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState } from "react";
import { DevicesPanel } from "./devices-panel";

export default { title: "Cloud/Devices", fullscreen: true };
export const StartStopAndRecover = () => {
  const [devices, setDevices] = useState<CloudDevice[]>([]);
  const [error, setError] = useState<string>();
  const [failNextStart, setFailNextStart] = useState(true);
  const [configured, setConfigured] = useState(false);
  return (
    <ChakraProvider value={psTheme}>
      <DevicesPanel
        provider={
          configured
            ? {
                configured: true,
                region: "ams3",
                size: "s-2vcpu-4gb",
                image: `ghcr.io/pufflyai/prompt-studio/device@sha256:${"a".repeat(64)}`,
              }
            : { configured: false }
        }
        devices={devices}
        accountDevices={[]}
        error={error}
        onDismiss={() => setError(undefined)}
        onRefresh={() => setError(undefined)}
        onConfigure={() => setConfigured(true)}
        onCreate={(name) =>
          setDevices([{ id: "fixture-device", name, providerId: "42", power: "active", online: true }])
        }
        onStart={() => {
          if (failNextStart) {
            setFailNextStart(false);
            setError("Cloud provider request failed. Refresh and try again.");
            return;
          }
          setDevices(devices.map((device) => ({ ...device, power: "active", online: true })));
        }}
        onStop={() => setDevices(devices.map((device) => ({ ...device, power: "off", online: null })))}
      />
    </ChakraProvider>
  );
};
