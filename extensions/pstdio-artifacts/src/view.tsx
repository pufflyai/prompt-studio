import "@pstdio/ui/style.css";
import { Center, Spinner, Stack } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type ResourceRef,
  registerWebviewResourceAction,
} from "@pstdio/sdk/extensions";
import { useScopedQueries, useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createArtifactQueries, createArtifactRevisionSelection } from "./artifact-queries";
import {
  artifactRevisionChoices,
  newerVersionsChoice,
  olderVersionsChoice,
  revisionChoicePrefix,
} from "./artifact-revision-choices";
import type { ArtifactSummary } from "./artifacts";
import type { commands } from "./commands";
import { ArtifactLibrary } from "./components/artifact-library";
import { ArtifactReader } from "./components/artifact-reader";
import { readPreviewTheme } from "./components/html-preview-theme";
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

  const exportLabel = context.t("reader.export", "Export HTML");
  useEffect(() => {
    if (!id || !content) return;
    const action = registerWebviewResourceAction(
      host,
      {
        resource: content.resource,
        label: exportLabel,
        icon: "download",
      },
      async (signal) => {
        setActionError(undefined);
        try {
          const result = await client.commands.export({
            url: content.url,
            revisionId: content.revisionId,
            theme: readPreviewTheme(),
          });
          signal.throwIfAborted();
          if (result.html === undefined) throw new Error("The export did not return HTML.");
          await client.files.download({
            name: result.fileName,
            data: new TextEncoder().encode(result.html),
            mimeType: "text/html;charset=utf-8",
          });
        } catch (error) {
          if (!signal.aborted) setActionError(String(error));
          throw error;
        }
      },
    );
    void action.ready.catch((error) => setActionError(String(error)));
    return () => {
      void action.dispose().catch(() => {});
    };
  }, [client, content, exportLabel, host, id]);

  const choices = useRef<ReturnType<typeof registerWebviewResourceAction> | null>(null);
  const [choicePage, setChoicePage] = useState(0);
  const versionsLabel = context.t("reader.versions", "Versions");
  const currentChoices = useEffectEvent(() =>
    artifactRevisionChoices(items ?? [], selected ?? content?.id ?? items?.[0]?.id, choicePage, context.t),
  );
  const chooseRevision = useEffectEvent(async (signal: AbortSignal, choiceId?: string) => {
    signal.throwIfAborted();
    if (choiceId === newerVersionsChoice || choiceId === olderVersionsChoice) {
      const { page, lastPage } = currentChoices();
      setChoicePage(Math.max(0, Math.min(lastPage, page + (choiceId === olderVersionsChoice ? 1 : -1))));
      return;
    }
    const revisionId = choiceId?.startsWith(revisionChoicePrefix)
      ? choiceId.slice(revisionChoicePrefix.length)
      : undefined;
    if (!revisionId || !items?.some((revision) => revision.id === revisionId))
      throw new Error("The selected artifact revision is no longer available.");
    try {
      setActionError(undefined);
      await selection.save(revisionId);
    } catch (error) {
      if (!signal.aborted) setActionError(String(error));
      throw error;
    }
  });
  // A content read can change while an accepted preference write is still completing.
  // The App key binds this lifetime to its project and resource.
  useEffect(() => {
    return () => {
      const registration = choices.current;
      choices.current = null;
      void registration?.dispose().catch(() => {});
    };
  }, []);
  useEffect(() => {
    if (!id || !items?.length || preference.data === undefined) return;
    const values = artifactRevisionChoices(
      items,
      selected ?? content?.id ?? items[0]?.id,
      choicePage,
      context.t,
    ).choices;
    const existing = choices.current;
    const registration =
      existing ??
      registerWebviewResourceAction(
        host,
        {
          resource: { type: "artifact", id, projectId: hostProps.projectId, extensionId: host.extensionId },
          label: versionsLabel,
          choices: values,
        },
        chooseRevision,
      );
    choices.current = registration;
    let cancelled = false;
    void (existing ? registration.updateChoices(values, { label: versionsLabel }) : registration.ready).catch(
      (error) => {
        if (!cancelled && choices.current === registration) setActionError(String(error));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [host, hostProps.projectId, id, content, items, selected, preference.data, choicePage, versionsLabel, context.t]);

  let body = (
    <Center flex="1">
      <Spinner />
    </Center>
  );
  if (id && content && items) {
    body = <ArtifactReader content={content} />;
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
