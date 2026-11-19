import "@pstdio/ui/style.css";
import { Box, Flex, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { useScopedQueries, useWebviewCommandQuery, useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import {
  ChakraProvider,
  FileIconThemePreferenceProvider,
  psTheme,
  resolveFileIconElement,
  useFileIconThemePreference,
} from "@pstdio/ui";
import { type Diff, DiffViewer } from "@pstdio/ui/diff";
import { Activity, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { createChangesQueries, createChangesSelection } from "./changes-queries";
import type { commands } from "./commands";
import { resolveDefaultWorkspaceDiffPath, resolveWorkspaceDiffRequest } from "./diff-state";

type Client = ReturnType<typeof createWebviewClient<typeof commands>>;
const Changes = ({ client, host }: { client: Client; host: WebviewHostProps }) => {
  const resource = host.resource;
  const workspaceId = resource?.id ?? "";
  const request = resolveWorkspaceDiffRequest({ resourceId: workspaceId, metadata: resource?.metadata });
  const comparison = host.pageParams?.comparison;
  let mode = request?.mode ?? "fork_point";
  if (comparison === "current" || comparison === "fork_point") mode = comparison;
  const ready = Boolean(request);
  const visible = useWebviewVisibility();
  const queries = createChangesQueries(client, workspaceId, mode, resource);
  const summary = useWebviewCommandQuery(queries.summary, ready && visible);
  const selection = createChangesSelection(client, host.projectId, workspaceId, mode);
  const preference = useWebviewCommandQuery(selection.query, ready && visible);
  const [writeError, setWriteError] = useState<Error>();
  const selectPath = (path: string | null) => {
    const value = path ?? "";
    if (preference.data?.value === value) return;
    void selection
      .save(value)
      .catch((error) => setWriteError(error instanceof Error ? error : new Error(String(error))));
  };
  const [requested, setRequested] = useState<string[]>([]);
  const files = summary.data?.files ?? [];
  const currentPaths = new Set(files.map((file) => file.newPath ?? file.oldPath ?? file.filePath));
  const bodies = useScopedQueries(
    requested.filter((path) => currentPaths.has(path)).map(queries.body),
    ready && visible,
  );
  const [readOwner, setReadOwner] = useState<{ query: typeof queries.summary; abort: AbortController }>();
  useLayoutEffect(() => {
    if (!visible || !ready) return;
    const abort = new AbortController();
    setReadOwner({ query: queries.summary, abort });
    return () => abort.abort();
  }, [queries.summary, visible, ready]);
  const byPath = new Map(
    bodies.flatMap((body) =>
      body.data ? [[body.data.newPath ?? body.data.oldPath ?? body.data.filePath, body.data] as const] : [],
    ),
  );
  const diffs: Diff[] = files.map((file) => {
    const body = byPath.get(file.newPath ?? file.oldPath ?? file.filePath);
    return {
      change: file.change,
      oldPath: file.oldPath ?? file.filePath,
      newPath: file.newPath ?? file.filePath,
      additions: file.additions,
      deletions: file.deletions,
      ...(body ? { oldContent: body.oldContent, newContent: body.newContent } : {}),
    };
  });
  const { activeFileIconTheme } = useFileIconThemePreference();
  const error = writeError || preference.error || summary.error || bodies.find((body) => body.error)?.error;
  if (!ready)
    return (
      <Flex h="full" align="center" justify="center" p="md">
        <Text>
          {String(resource?.metadata?.workspaceError || "Changes require a ready workspace with Git support.")}
        </Text>
      </Flex>
    );
  return (
    <Flex direction="column" h="100dvh" minH="0" minW="0">
      {error && (
        <Text role="alert" p="sm" color="fg.error">
          {String(error)}
        </Text>
      )}
      <Box flex="1" minH="0" position="relative">
        <Box position="absolute" inset="0" display="flex" minH="0" minW="0">
          {preference.data !== undefined ? (
            <DiffViewer
              diffs={diffs}
              changedFilePaths={files.map((file) => file.newPath ?? file.oldPath ?? file.filePath)}
              selectedPath={
                typeof preference.data?.value === "string" && preference.data.value ? preference.data.value : null
              }
              onSelectedPathChange={selectPath}
              defaultSelectedPath={resolveDefaultWorkspaceDiffPath(files)}
              loading={summary.data === undefined || summary.loading}
              onLoadDiff={async (path) => {
                const signal = readOwner?.abort.signal;
                if (!visible || !signal || signal.aborted || readOwner?.query !== queries.summary) return;
                setRequested((current) => (current.includes(path) ? current : [...current, path]));
                await queries.body(path).read(signal);
              }}
              resolveFileIcon={(path) => ({
                icon: resolveFileIconElement(path.split("/").at(-1) ?? path, { theme: activeFileIconTheme }),
                color: "fg.subtle",
              })}
            />
          ) : (
            <Text role="status" p="sm">
              Loading changes...
            </Text>
          )}
        </Box>
      </Box>
    </Flex>
  );
};
const View = ({ context }: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const host = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  const visible = useWebviewVisibility();
  return (
    <ChakraProvider value={psTheme}>
      <FileIconThemePreferenceProvider>
        <Activity mode={visible ? "visible" : "hidden"}>
          <Changes
            key={`${host.projectId}:${host.resource?.id}:${host.pageParams?.comparison}`}
            client={client}
            host={host}
          />
        </Activity>
      </FileIconThemePreferenceProvider>
    </ChakraProvider>
  );
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => {
      root.unmount();
      createWebviewClient(context.host).queries.dispose();
    };
  },
});
