import { Box, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { type ReactNode, useEffect, useState } from "react";
import {
  type CollectionSettingsPanel,
  getWorkbenchRenderers,
  type PreferenceScope,
  type SettingsRegistry,
  type WorkbenchPanelRenderInput,
} from "../../core";
import { WorkbenchPreferencesForm } from "../renderers/settings/preferences-form";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { useSettingsRevision } from "./use-settings-revision";

export interface SettingsSurfacePanelProps {
  input: WorkbenchPanelRenderInput;
  settings: SettingsRegistry;
  resolveScopeId?: (scope: PreferenceScope) => string | undefined;
}

const Centered = (props: { children: ReactNode }) => (
  <Flex h="full" minH="0" align="center" justify="center" p="lg">
    {props.children}
  </Flex>
);

const ScrollableSettingsContent = (props: { children: ReactNode }) => (
  <ScrollArea h="full" minH="0" contentProps={{ h: "full", minH: "full" }}>
    <Box h="full" minH="full">
      {props.children}
    </Box>
  </ScrollArea>
);

const SettingsViewContent = (props: { input: WorkbenchPanelRenderInput; panelId: string; viewId: string }) => {
  const { input, panelId, viewId } = props;
  const renderer = useWorkbenchStore(getWorkbenchRenderers(input.workbench).store, (state) => state.renderers[viewId]);
  useWorkbenchStore(getWorkbenchRenderers(input.workbench).store, (state) => state.refreshKeys[viewId] ?? 0);
  if (!renderer) {
    return (
      <Centered>
        <EmptyState title="Settings View not found" />
      </Centered>
    );
  }
  return (
    <ScrollableSettingsContent>
      {renderer.render({ ...input, instance: { ...input.instance, panelId, viewId } }) as ReactNode}
    </ScrollableSettingsContent>
  );
};

// Resolve async collection data before rendering its registered View. The View
// can read the current item from settings by the stable panel and item ids.
const CollectionItemView = (props: {
  panel: CollectionSettingsPanel;
  itemId: string;
  input: WorkbenchPanelRenderInput;
}) => {
  const { panel, itemId, input } = props;
  const resolveCollectionItem = input.workbench.settings.resolveCollectionItem;
  const [state, setState] = useState<{ status: "loading" | "ready" | "missing" }>({
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    resolveCollectionItem(panel.id, itemId).then((item) => {
      if (!alive) return;
      setState(item === undefined ? { status: "missing" } : { status: "ready" });
    });
    return () => {
      alive = false;
    };
  }, [panel, itemId, resolveCollectionItem]);

  if (state.status === "loading")
    return (
      <Centered>
        <Spinner size="sm" />
      </Centered>
    );
  if (state.status === "missing")
    return (
      <Centered>
        <EmptyState title="Item not found" />
      </Centered>
    );
  return <SettingsViewContent input={input} panelId={panel.id} viewId={panel.viewId} />;
};

// The single main-region renderer for the settings surface. Dispatches the open
// resource to a schema form, a custom view, or a collection item editor.
export const SettingsSurfacePanel = (props: SettingsSurfacePanelProps) => {
  const { input, settings, resolveScopeId } = props;
  const revision = useSettingsRevision(settings);
  const resource = input.instance.resource;
  const panelId = typeof resource?.metadata?.panelId === "string" ? resource.metadata.panelId : undefined;
  const itemId = typeof resource?.metadata?.itemId === "string" ? resource.metadata.itemId : undefined;
  const panel = panelId ? settings.getPanel(panelId) : undefined;

  if (!panel) {
    return (
      <Centered>
        <EmptyState title="Select a settings entry" description="Pick an item from the settings sidenav." />
      </Centered>
    );
  }

  if (panel.kind === "view") return <SettingsViewContent input={input} panelId={panel.id} viewId={panel.viewId} />;

  if (panel.kind === "collection") {
    if (!itemId)
      return (
        <Centered>
          <EmptyState title={panel.title} />
        </Centered>
      );
    return (
      <CollectionItemView key={`${resource?.uri ?? itemId}:${revision}`} panel={panel} itemId={itemId} input={input} />
    );
  }

  return (
    <ScrollArea h="full" minH="0" contentProps={{ p: "lg", display: "flex", flexDirection: "column", gap: "md" }}>
      <Stack gap="xs">
        <Text textStyle="heading/M/semibold">{panel.title}</Text>
        {panel.description && (
          <Text textStyle="paragraph/S/regular" color="fg.muted" maxW="640px">
            {panel.description}
          </Text>
        )}
      </Stack>
      <WorkbenchPreferencesForm
        preferences={input.workbench.preferences}
        names={panel.preferences}
        resolveScopeId={resolveScopeId}
        mode={panel.save ?? "live"}
      />
    </ScrollArea>
  );
};
