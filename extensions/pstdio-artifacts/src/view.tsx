import "@pstdio/ui/style.css";
import { Center, Spinner, Stack } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { ArtifactContent, ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { ArtifactLibrary } from "./components/artifact-library";
import { ArtifactReader } from "./components/artifact-reader";
import { artifactUrl, changedEvent, libraryTarget } from "./contracts";
import { ArtifactTranslations } from "./translations";

interface HostProps {
  projectId: string;
  resource?: ResourceRef;
}

interface AppProps {
  context: ExtensionViewRenderContext<HostProps>;
  hostProps: HostProps;
}

const ArtifactsApp = (props: AppProps) => {
  const { context, hostProps } = props;
  const { host } = context;
  const [client] = useState(() => createWebviewClient<typeof commands>(host));
  const [items, setItems] = useState<ArtifactSummary[]>();
  const [content, setContent] = useState<ArtifactContent>();
  const [selected, setSelected] = useState<string>();
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string>();
  const id = hostProps.resource?.id;
  const url = id ? artifactUrl(hostProps.projectId, id) : undefined;
  useEffect(() => client.events.subscribe(changedEvent, () => setRefresh((value) => value + 1)), [client]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: Artifact changes invalidate the server query.
  useEffect(() => {
    let cancelled = false;
    const query = url ? client.commands.revisions({ url }) : client.commands.list();
    void query
      .then((items) => {
        if (!cancelled) {
          setItems(items);
          setError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [client, url, refresh]);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    void client.commands
      .read({ url, revisionId: selected })
      .then((content) => {
        if (!cancelled) {
          setContent(content);
          setError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [client, url, selected]);

  const open = async (item: ArtifactSummary) => {
    await host.call("navigation.open", { target: item.target });
  };

  let body = (
    <Center flex="1">
      <Spinner />
    </Center>
  );
  if (id && content && items) {
    body = (
      <ArtifactReader
        content={content}
        revisions={items}
        onSelect={setSelected}
        onRename={async (name) => {
          if (!url) return;
          const renamed = await client.commands.rename({ url, name });
          setRefresh((value) => value + 1);
          await open(renamed);
        }}
        onDelete={async () => {
          if (!url) return;
          await client.commands.delete({ url });
          await host.call("placement.close", {});
          await host.call("navigation.open", { target: libraryTarget });
        }}
        onBack={() => {
          void host.call("navigation.open", { target: libraryTarget });
        }}
      />
    );
  } else if (!id && items) {
    body = (
      <ArtifactLibrary
        items={items}
        onOpen={(item) => {
          void open(item);
        }}
        loadPreview={async (item) => (await client.commands.read({ url: item.url, revisionId: item.revisionId })).html}
      />
    );
  }
  return (
    <Stack height="100dvh" minHeight="0" gap="0" bg="bg" color="fg">
      {error ? <AlertMessage status="error" title={error} /> : null}
      {body}
    </Stack>
  );
};

const View = (props: { context: ExtensionViewRenderContext<HostProps> }) => {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  return (
    <ChakraProvider value={psTheme}>
      <ArtifactTranslations value={{ t: context.t, locale: context.locale }}>
        <ArtifactsApp
          key={`${hostProps.projectId}:${hostProps.resource?.id ?? "library"}`}
          context={context}
          hostProps={hostProps}
        />
      </ArtifactTranslations>
    </ChakraProvider>
  );
};

export default defineExtensionView<HostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => root.unmount();
  },
});
