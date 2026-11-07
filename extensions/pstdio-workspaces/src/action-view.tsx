import "@pstdio/ui/style.css";
import { Box, Button, type ButtonProps, Stack, Text } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  getCommandValue,
  type JsonObject,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme, ScrollArea } from "@pstdio/ui";
import { ParamEditorRow } from "@pstdio/ui/param-editor";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { workspaceTarget } from "./model";
import { type ExecuteOptions, ProviderForm } from "./provider-form";
import { workspacePages } from "./refs";

type Client = ReturnType<typeof createWebviewClient<typeof commands>>;
type FormData = Awaited<ReturnType<Client["commands"]["read-form"]>>;
const actionTitle = (operation: string) =>
  ({
    create: "Create workspace",
    rename: "Rename workspace",
    "delete-entry": "Delete entry",
    delete: "Delete workspace",
  })[operation] ?? "Workspace action";
const selectedPath = (host: WebviewHostProps) =>
  typeof host.pageParams?.selected === "string" ? host.pageParams.selected : undefined;
// psTheme supplies these custom variants; published Chakra types list only built-ins.
const MutationForm = ({
  client,
  host,
  data,
  operation,
  busy,
  run,
}: {
  client: Client;
  host: WebviewHostProps;
  data: FormData;
  operation: string;
  busy: boolean;
  run: (action: () => Promise<unknown>) => Promise<void>;
}) => {
  const [name, setName] = useState(data.workspace?.name ?? "");
  const workspaceId = String(host.pageParams?.["workspace-id"] ?? "");
  const path = String(host.pageParams?.path ?? "");
  const submit = () =>
    run(() => {
      if (operation === "rename") return client.commands.rename({ id: workspaceId, name });
      if (operation === "delete-entry")
        return client.commands["delete-entry"]({ workspaceId, path, confirmed: true, selected: selectedPath(host) });
      return client.commands.delete({ id: workspaceId, confirmed: true });
    });
  const label = operation === "delete-entry" ? path : data.workspace?.name || data.workspace?.shorthand;
  const consequence =
    operation === "delete-entry"
      ? "The entry and its contents will be permanently removed."
      : "This removes the workspace and its files. Session history is kept.";
  return (
    <Stack>
      {operation === "rename" ? (
        <ParamEditorRow
          param={{ id: "name", name: "Name", type: "text", defaultValue: name }}
          readOnly={busy}
          onChange={(_, value) => setName(String(value ?? ""))}
        />
      ) : (
        <Text>
          Delete {label}? {consequence}
        </Text>
      )}
      <Button
        variant={(operation === "rename" ? "primary" : "destructive") as ButtonProps["variant"]}
        loading={busy}
        disabled={operation === "rename" && !name.trim()}
        onClick={() => {
          void submit().catch(() => {});
        }}
      >
        {operation === "rename" ? "Rename" : "Delete"}
      </Button>
    </Stack>
  );
};
const Action = ({
  client,
  host,
  executeOptions,
}: {
  client: Client;
  host: WebviewHostProps;
  executeOptions: ExecuteOptions;
}) => {
  const [data, setData] = useState<FormData>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const operation = String(host.pageParams?.operation ?? "create");
  const workspaceId = String(host.pageParams?.["workspace-id"] ?? "");
  useEffect(() => {
    let disposed = false;
    void client.commands["read-form"]({ workspaceId: workspaceId || undefined })
      .then((value) => {
        if (!disposed) setData(value);
      })
      .catch((error) => {
        if (!disposed) setError(String(error));
      });
    return () => {
      disposed = true;
    };
  }, [client, workspaceId]);
  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (error) {
      setError(String(error));
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const create = async (providerId: string, params: Record<string, unknown>) =>
    run(async () => {
      await client.commands.create({
        providerId,
        params: JSON.parse(JSON.stringify(params)) as JsonObject,
        anchors: host.pageParams?.anchors ? JSON.parse(String(host.pageParams.anchors)) : undefined,
        shorthandBase: typeof host.pageParams?.shorthand === "string" ? host.pageParams.shorthand : undefined,
      });
      if (host.presentation === "dialog") await client.placement.close();
    });
  const cancel = () => {
    if (host.presentation === "dialog") return client.placement.close();
    if (!data && workspaceId) return client.commands.open({ id: workspaceId, selected: selectedPath(host) });
    if (!data?.workspace) return client.navigation.open({ kind: "page", page: workspacePages.list });
    const path = selectedPath(host);
    const projectId = host.projectId ?? data.workspace.projectId;
    if (!projectId) throw new Error("Project is unavailable.");
    return client.navigation.open(workspaceTarget(data.workspace, projectId, path ? { workspaceFilePath: path } : {}));
  };
  if (operation === "create" && data?.providers.length)
    return (
      <Stack gap="0">
        {host.presentation !== "dialog" ? (
          <Text textStyle="heading/M" px="lg" pt="lg">
            Create workspace
          </Text>
        ) : null}
        {error ? (
          <Box px="lg" pt="md">
            <AlertMessage status="error" title="Workspace action failed">
              {error}
            </AlertMessage>
          </Box>
        ) : null}
        <ProviderForm
          providers={data.providers}
          executeOptions={executeOptions}
          busy={busy}
          submit={create}
          onCancel={() => void cancel().catch((error) => setError(String(error)))}
        />
      </Stack>
    );
  let content = <Text>Loading workspace…</Text>;
  if (data)
    content =
      operation === "create" ? (
        <Text>Attach a project folder or enable a workspace provider in settings.</Text>
      ) : (
        <MutationForm client={client} host={host} data={data} operation={operation} busy={busy} run={run} />
      );
  return (
    <ScrollArea h="full" w="full">
      <Stack maxW="xl" mx="auto" p="lg" gap="lg">
        <Text textStyle="heading/M">{actionTitle(operation)}</Text>
        {error && (
          <AlertMessage status="error" title="Workspace action failed">
            {error}
          </AlertMessage>
        )}
        {content}
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            void cancel().catch((error) => setError(String(error)));
          }}
        >
          Cancel
        </Button>
      </Stack>
    </ScrollArea>
  );
};
const View = ({ context }: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const host = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<typeof commands>(context.host));
  const executeOptions: ExecuteOptions = async (commandId, params) =>
    getCommandValue(
      (
        await context.host.call("commands.execute", {
          commandId,
          params: JSON.parse(JSON.stringify(params)) as JsonObject,
        })
      ).outcome,
    );
  return (
    <ChakraProvider value={psTheme}>
      <Action
        key={`${host.projectId}:${JSON.stringify(host.pageParams)}`}
        host={host}
        client={client}
        executeOptions={executeOptions}
      />
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
