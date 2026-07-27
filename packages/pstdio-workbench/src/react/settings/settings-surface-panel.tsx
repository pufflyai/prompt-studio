import { Box, Flex, Spinner, Stack, Text } from "@chakra-ui/react";
import { EmptyState, ScrollArea } from "@pstdio/ui";
import { type ReactNode, useEffect, useState } from "react";
import type { CollectionSettingsPanel, PreferenceScope, SettingsRegistry, WorkbenchPanelRenderInput } from "../../core";
import { WorkbenchPreferencesForm } from "../renderers/settings/preferences-form";
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

// Resolves a collection item by id (items() may be async) and renders the
// contributor-supplied editor. The framework never knows what the item is.
const CollectionItemView = (props: {
  panel: CollectionSettingsPanel;
  itemId: string;
  input: WorkbenchPanelRenderInput;
}) => {
  const { panel, itemId, input } = props;
  const [state, setState] = useState<{ status: "loading" | "ready" | "missing"; item?: unknown }>({
    status: "loading",
  });

  useEffect(() => {
    let alive = true;
    setState({ status: "loading" });
    Promise.resolve(panel.items()).then((items) => {
      if (!alive) return;
      const item = items.find((candidate) => panel.itemId(candidate) === itemId);
      setState(item === undefined ? { status: "missing" } : { status: "ready", item });
    });
    return () => {
      alive = false;
    };
  }, [panel, itemId]);

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
  return <ScrollableSettingsContent>{panel.renderItem(state.item, input) as ReactNode}</ScrollableSettingsContent>;
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

  if (panel.kind === "custom")
    return <ScrollableSettingsContent>{panel.render(input) as ReactNode}</ScrollableSettingsContent>;

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
