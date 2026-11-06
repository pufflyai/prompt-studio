import "@pstdio/ui/style.css";
import { Box, Button, Flex, HStack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { useCommandQuery } from "@pstdio/sdk/extensions/react";
import {
  ChakraProvider,
  FileIconThemePreferenceProvider,
  psTheme,
  resolveFileIconElement,
  useFileIconThemePreference,
} from "@pstdio/ui";
import { type Diff, DiffViewer } from "@pstdio/ui/diff";
import { QueryClient, QueryClientProvider, useQueries, useQueryClient } from "@tanstack/react-query";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { resolveDefaultWorkspaceDiffPath, resolveWorkspaceDiffRequest } from "./diff-state";
import { refreshEvents } from "./events";

type Client = ReturnType<typeof createWebviewClient<typeof commands>>;
const Changes = ({ client, host }: { client: Client; host: WebviewHostProps }) => {
  const resource = host.resource;
  const workspaceId = resource?.id ?? "";
  const request = resolveWorkspaceDiffRequest({ resourceId: workspaceId, metadata: resource?.metadata });
  const comparison = host.pageParams?.comparison;
  let mode = request?.mode ?? "fork_point";
  if (comparison === "current" || comparison === "fork_point") mode = comparison;
  const ready = Boolean(request);
  const summary = useCommandQuery({
    queryKey: ["workspace-changes", workspaceId, mode],
    command: async () => {
      const value = await client.commands["read-changes"]({ workspaceId, mode });
      await queryClient.invalidateQueries({ queryKey: ["workspace-diff", workspaceId, mode] });
      return value;
    },
    enabled: ready,
    refreshOn: { client, events: refreshEvents },
  });
  const queryClient = useQueryClient();
  const [requested, setRequested] = useState<string[]>([]);
  const options = (path: string) => ({
    queryKey: ["workspace-diff", workspaceId, mode, path],
    queryFn: () => client.commands["read-diff"]({ workspaceId, mode, path }),
  });
  const bodies = useQueries({ queries: requested.map(options) });
  const byPath = new Map(
    bodies.flatMap((body) =>
      body.data ? [[body.data.newPath ?? body.data.oldPath ?? body.data.filePath, body.data] as const] : [],
    ),
  );
  const files = summary.data?.files ?? [];
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
  const error = summary.error || bodies.find((body) => body.error)?.error;
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
      <HStack p="xs" flexShrink="0" gap="xs" aria-label="Compare changes">
        <Button
          size="xs"
          variant={mode === "current" ? "subtle" : "ghost"}
          onClick={() => {
            void client.page.updateParams({ comparison: "current" });
          }}
        >
          Current changes
        </Button>
        <Button
          size="xs"
          variant={mode === "fork_point" ? "subtle" : "ghost"}
          onClick={() => {
            void client.page.updateParams({ comparison: "fork_point" });
          }}
        >
          Since fork point
        </Button>
      </HStack>
      {error && (
        <Text role="alert" p="sm" color="fg.error">
          {String(error)}
        </Text>
      )}
      <Box flex="1" minH="0" position="relative">
        <Box position="absolute" inset="0" display="flex" minH="0" minW="0">
          <DiffViewer
            diffs={diffs}
            changedFilePaths={files.map((file) => file.newPath ?? file.oldPath ?? file.filePath)}
            defaultSelectedPath={resolveDefaultWorkspaceDiffPath(files)}
            loading={summary.isPending}
            onLoadDiff={async (path) => {
              setRequested((current) => (current.includes(path) ? current : [...current, path]));
              await queryClient.fetchQuery(options(path));
            }}
            resolveFileIcon={(path) => ({
              icon: resolveFileIconElement(path.split("/").at(-1) ?? path, { theme: activeFileIconTheme }),
              color: "fg.subtle",
            })}
          />
        </Box>
      </Box>
    </Flex>
  );
};
const View = ({ context }: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const host = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  const [queryClient] = useState(() => new QueryClient());
  return (
    <ChakraProvider value={psTheme}>
      <FileIconThemePreferenceProvider>
        <QueryClientProvider client={queryClient}>
          <Changes
            key={`${host.projectId}:${host.resource?.id}:${host.pageParams?.comparison}`}
            client={client}
            host={host}
          />
        </QueryClientProvider>
      </FileIconThemePreferenceProvider>
    </ChakraProvider>
  );
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => root.unmount();
  },
});
