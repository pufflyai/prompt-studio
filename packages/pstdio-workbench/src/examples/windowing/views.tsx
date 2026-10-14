import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";
import { type ResourceRef, resourceKey } from "@pstdio/sdk/extensions";
import { useEffect, useState } from "react";
import { useShowcaseStore } from "../showcases/showcase-store";
import { WindowingFileTree } from "./file-tree";
import type { WindowingLifecycleProbe } from "./lifecycle-probe";

interface ResourceListProps {
  label: string;
  resources: readonly ResourceRef[];
  onOpen(resource: ResourceRef): void;
}

export const WindowingResourceList = (props: ResourceListProps) => {
  const { label, resources, onOpen } = props;
  return (
    <Stack p="md" gap="sm">
      <Text as="h2" textStyle="heading/S/semibold">
        {label}
      </Text>
      {resources.map((resource) => (
        <Button key={resource.id} size="sm" variant="outline" onClick={() => onOpen(resource)}>
          {resource.label}
          {resource.metadata?.workspaceId ? ` · ${resource.metadata.workspaceId}` : ""}
        </Button>
      ))}
    </Stack>
  );
};

interface DraftViewProps {
  label: string;
  probe: WindowingLifecycleProbe;
  resource?: ResourceRef;
}

export const WindowingDraftView = (props: DraftViewProps) => {
  const { label, probe, resource } = props;
  const [draft, setDraft] = useState("");
  const [mount, setMount] = useState(0);
  const key = `${label}:${resourceKey(resource)}`;
  useEffect(() => {
    setMount(probe.mounted(key));
  }, [key, probe]);
  useEffect(() => {
    if (label === "Session" && resource) probe.attach(resource);
  }, [label, resource, probe]);
  return (
    <Stack role="group" aria-label={`${label} view`} p="md" gap="sm">
      <Text textStyle="heading/S/semibold">{resource?.label ?? label}</Text>
      <Text color="fg.muted" textStyle="paragraph/S/regular">
        {label} · {resourceKey(resource)}
      </Text>
      <Text aria-label={`${label} mount`} textStyle="paragraph/S/regular">
        Mount {mount}
      </Text>
      {(label === "Files" || label === "Changes") && <WindowingFileTree label={label} />}
      {resource?.context && (
        <Text aria-label={`${label} context`} color="fg.muted">
          {resource.context.label ?? "Project"}
        </Text>
      )}
      <Input aria-label={`${label} draft`} size="sm" value={draft} onChange={(event) => setDraft(event.target.value)} />
    </Stack>
  );
};

interface TerminalViewProps {
  probe: WindowingLifecycleProbe;
  resource: ResourceRef;
}

export const WindowingTerminalView = (props: TerminalViewProps) => {
  const { probe, resource } = props;
  const state = useShowcaseStore(probe.store);
  useEffect(() => {
    probe.attach(resource);
  }, [probe, resource]);
  const session = state.sessions[resourceKey(resource)];
  return (
    <Stack p="md" gap="sm">
      <Text textStyle="heading/S/semibold">{resource.label}</Text>
      <Text aria-label="Terminal binding" textStyle="paragraph/S/regular">
        {String(resource.metadata?.workspaceId)}
      </Text>
      <Text aria-label="Terminal lifecycle" textStyle="paragraph/S/regular">
        Starts {session?.starts ?? 0} · Stops {session?.stops ?? 0}
      </Text>
      <Button
        size="xs"
        variant="outline"
        onClick={() => (session?.running ? probe.stop(resource) : probe.start(resource))}
      >
        {session?.running ? "Stop" : "Start"} {resource.label}
      </Button>
      <Text color="fg.muted" textStyle="paragraph/XS/regular">
        Lifecycle probe. No real terminal process.
      </Text>
    </Stack>
  );
};

export const WindowingWebview = () => (
  <Box asChild h="full" minH="full" w="full">
    <iframe
      title="Windowing webview"
      sandbox="allow-scripts"
      srcDoc={`<!doctype html><html><body>
      <h1>Windowing webview</h1>
      <label>Webview draft <input aria-label="Webview draft"></label>
      <p>Mount identity: <output aria-label="Webview mount"></output></p>
      <script>document.querySelector('output').textContent = crypto.randomUUID();</script>
    </body></html>`}
    />
  </Box>
);
