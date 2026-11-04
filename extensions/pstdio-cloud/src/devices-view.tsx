import "@pstdio/ui/style.css";
import { Button, Heading, Stack, Text } from "@chakra-ui/react";
import { accountEvents, createWebviewClient, defineExtensionView, type WebviewClient } from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createDevicesController } from "./devices-controller";
import { DevicesPanel } from "./devices-panel";

interface DevicesViewProps {
  client: WebviewClient<object>;
  controller: ReturnType<typeof createDevicesController>;
}

const DevicesView = (props: DevicesViewProps) => {
  const { client, controller } = props;
  const state = useSyncExternalStore(controller.subscribe, controller.get);
  const [pendingLogin, setPendingLogin] = useState<string>();
  useEffect(() => {
    void controller.refresh();
    return client.events.subscribe(accountEvents.changed, () => {
      void controller.refresh();
    });
  }, [client, controller]);
  useEffect(() => {
    if (!pendingLogin) return;
    let closed = false;
    const poll = async () => {
      try {
        const status = await client.account.loginStatus(pendingLogin);
        if (closed || status === "pending") return;
        setPendingLogin(undefined);
        if (status === "complete") await controller.refresh();
        else
          await controller.run("Checking sign-in", async () => {
            throw new Error("Sign-in did not complete. Try again.");
          });
      } catch (cause) {
        if (!closed) {
          setPendingLogin(undefined);
          await controller.run("Checking sign-in", async () => {
            throw cause;
          });
        }
      }
    };
    const clock = setInterval(() => void poll(), 1000);
    return () => {
      closed = true;
      clearInterval(clock);
      void client.account.cancelLogin(pendingLogin).catch(() => {});
    };
  }, [client, controller, pendingLogin]);
  const login = () =>
    controller.run("Opening sign-in", async () => {
      const request = await client.account.login();
      setPendingLogin(request.id);
      await client.navigation.open({ kind: "href", href: request.url });
    });
  if (!state.signedIn)
    return (
      <Stack padding="md" gap="md">
        <Heading size="md">Devices</Heading>
        {state.busy ? (
          <Text role="status">
            {state.busy} · {state.elapsed ?? 0}s
          </Text>
        ) : null}
        {pendingLogin ? (
          <>
            <Text role="status">Complete sign-in in your browser.</Text>
            <Button
              onClick={() => {
                void controller
                  .run("Cancelling sign-in", () => client.account.cancelLogin(pendingLogin))
                  .finally(() => setPendingLogin(undefined));
              }}
            >
              Cancel sign-in
            </Button>
          </>
        ) : (
          <Button disabled={Boolean(state.busy)} onClick={() => void login()}>
            Sign in
          </Button>
        )}
        {state.error ? (
          <AlertMessage
            status="error"
            title="Device request failed"
            onClose={controller.dismiss}
            endElement={<Button onClick={() => void controller.refresh()}>Refresh</Button>}
          >
            {state.error}
          </AlertMessage>
        ) : null}
      </Stack>
    );
  return (
    <DevicesPanel
      key={state.accountId}
      {...state}
      accountDevices={state.accountDevices ?? []}
      accountDevicesUnavailable={state.accountDevices === null}
      onDismiss={controller.dismiss}
      onRefresh={() => void controller.refresh()}
      onConfigure={(input) =>
        void controller.run("Saving provider", () => client.account.configureCloudDeviceProvider(input))
      }
      onCreate={(name) => void controller.run("Starting cloud device", () => client.account.startCloudDevice({ name }))}
      onStart={(id) => void controller.run("Starting cloud device", () => client.account.startCloudDevice({ id }))}
      onStop={(id) => void controller.run("Stopping cloud device", () => client.account.stopCloudDevice(id))}
    />
  );
};

export default defineExtensionView({
  render(context) {
    const client = createWebviewClient(context.host);
    const controller = createDevicesController(client.account);
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <DevicesView client={client} controller={controller} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
