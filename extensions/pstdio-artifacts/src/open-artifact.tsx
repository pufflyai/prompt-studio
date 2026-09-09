import "@pstdio/ui/style.css";
import { Center, Spinner } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { artifactUrl } from "./contracts";

interface HostProps {
  projectId: string;
  resource?: ResourceRef;
}

const OpenArtifact = (props: { context: ExtensionViewRenderContext<HostProps> }) => {
  const { context } = props;
  const { host } = context;
  const { projectId, resource } = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<typeof commands>(host));
  const [error, setError] = useState<string>();
  const id = resource?.id;
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void client.commands
      .open({ url: artifactUrl(projectId, id) })
      .then(async (target) => {
        if (!cancelled) await host.call("navigation.open", { target });
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [client, host, projectId, id]);
  return (
    <Center height="100dvh" bg="bg" color="fg">
      {error ? <AlertMessage status="error" title={error} /> : <Spinner />}
    </Center>
  );
};

export default defineExtensionView<HostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(
      <ChakraProvider value={psTheme}>
        <OpenArtifact context={context} />
      </ChakraProvider>,
    );
    return () => root.unmount();
  },
});
