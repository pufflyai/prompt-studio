import "@pstdio/ui/style.css";
import { Center, Spinner, Stack } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
} from "@pstdio/sdk/extensions";
import { useScopedQueries, useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createArtifactQueries, createArtifactRevisionSelection } from "./artifact-queries";
import type { ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { ArtifactLibrary } from "./components/artifact-library";
import { ArtifactReader } from "./components/artifact-reader";
import type { ArtifactExample } from "./create-artifact";
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
  const [actionError, setActionError] = useState<string>();
  const [creating, setCreating] = useState<ArtifactExample>();
  const id = hostProps.resource?.id;
  const visible = useWebviewVisibility();
  const selection = createArtifactRevisionSelection(client, hostProps.projectId, id ?? "library");
  const preference = useWebviewCommandQuery(selection.query, Boolean(id) && visible);
  const selected =
    typeof preference.data?.value === "string" && preference.data.value ? preference.data.value : undefined;
  const setSelected = (revision: string) => {
    void selection.save(revision).catch((error) => setActionError(String(error)));
  };
  const queries = createArtifactQueries(client, hostProps.projectId);
  const index = useWebviewCommandQuery(id ? queries.revisions(id) : queries.list(), visible);
  const reads = useScopedQueries(id && preference.data !== undefined ? [queries.content(id, selected)] : [], visible);
  const items = index.data;
  const content = reads[0]?.data;
  const error = actionError ?? preference.error?.message ?? index.error?.message ?? reads[0]?.error?.message;

  const open = async (item: ArtifactSummary) => {
    await host.call("navigation.open", { target: item.target });
  };

  const create = async (example: ArtifactExample) => {
    setCreating(example);
    setActionError(undefined);
    try {
      await client.commands["start-creation"]({ example });
    } catch (error) {
      setActionError(String(error));
    } finally {
      setCreating(undefined);
    }
  };

  let body = (
    <Center flex="1">
      <Spinner />
    </Center>
  );
  if (id && content && items) {
    body = <ArtifactReader content={content} revisions={items} onSelect={setSelected} />;
  } else if (!id && items) {
    body = (
      <ArtifactLibrary
        items={items}
        creating={creating}
        onCreate={(example) => {
          void create(example);
        }}
        onOpen={(item) => {
          void open(item).catch((error) => setActionError(String(error)));
        }}
        loadPreview={queries.preview}
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
    return () => {
      root.unmount();
      createWebviewClient(context.host).queries.dispose();
    };
  },
});
