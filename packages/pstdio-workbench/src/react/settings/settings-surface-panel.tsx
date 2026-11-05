import { Box, Flex, HStack, Stack } from "@chakra-ui/react";
import { resourceKey } from "@pstdio/sdk/extensions";
import { EmptyState, SettingsContentSkeleton, SettingsPage } from "@pstdio/ui";
import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import {
  type CollectionSettingsPanel,
  getWorkbenchRenderers,
  type PreferenceScope,
  type SettingsRegistry,
  type WorkbenchPanelRenderInput,
} from "../../core";
import { getSettingsPanels } from "../../core/registries/settings/settings-registry";
import { WorkbenchPreferencesForm } from "../renderers/settings/preferences-form";
import { WorkbenchIcon } from "../shared/icon";
import { useWorkbenchStore } from "../shared/use-workbench-store";
import { settingsLeaveGuard } from "./settings-leave-guard";
import { SettingsHeaderContext, SettingsPageContext } from "./settings-page-context";
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
const SettingsViewContent = (props: {
  input: WorkbenchPanelRenderInput;
  panelId: string;
  viewId: string;
  embedded?: boolean;
}) => {
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
  const content = renderer.render({
    ...input,
    sizing: props.embedded ? "content-height" : undefined,
    instance: {
      ...input.instance,
      instanceId: JSON.stringify([input.instance.instanceId, panelId, viewId]),
      panelId,
      viewId,
    },
  }) as ReactNode;
  return content;
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
  const [state, setState] = useState<{
    status: "loading" | "ready" | "missing";
  }>({
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
  if (state.status === "loading") return <SettingsContentSkeleton />;
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
const SettingsSurfaceContent = (props: SettingsSurfacePanelProps) => {
  const { input, settings, resolveScopeId } = props;
  const settingsState = useWorkbenchStore(settings.store, (state) => state);
  const resource = input.instance.resource;
  const panelId = typeof resource?.metadata?.panelId === "string" ? resource.metadata.panelId : undefined;
  const itemId = typeof resource?.metadata?.itemId === "string" ? resource.metadata.itemId : undefined;
  const panel = panelId ? settingsState.panels[panelId] : undefined;
  if (!panel) {
    return (
      <Centered>
        <EmptyState title="Select a settings entry" description="Pick an item from the settings sidenav." />
      </Centered>
    );
  }
  if (panel.kind === "view") {
    const children = getSettingsPanels(settingsState).filter(
      (child) => child.parentPanelId === panel.id && input.workbench.context.matches(child.when),
    );
    if (children.length === 0) return <SettingsViewContent input={input} panelId={panel.id} viewId={panel.viewId} />;
    return (
      <Stack gap="md">
        <SettingsViewContent embedded input={input} panelId={panel.id} viewId={panel.viewId} />
        {children.map((child) =>
          child.kind === "view" ? (
            <SettingsViewContent embedded key={child.id} input={input} panelId={child.id} viewId={child.viewId} />
          ) : null,
        )}
      </Stack>
    );
  }
  if (panel.kind === "collection") {
    if (!itemId)
      return (
        <Centered>
          <EmptyState title={panel.title} />
        </Centered>
      );
    return (
      <CollectionItemView
        key={`${resourceKey(resource) ?? itemId}:${settingsState.revision}`}
        panel={panel}
        itemId={itemId}
        input={input}
      />
    );
  }
  return (
    <WorkbenchPreferencesForm
      preferences={input.workbench.preferences}
      names={panel.preferences}
      resolveScopeId={resolveScopeId}
      mode={panel.save ?? "live"}
    />
  );
};

export const SettingsSurfacePanel = (props: SettingsSurfacePanelProps) => {
  const { input, settings } = props;
  const state = useWorkbenchStore(settings.store, (value) => value);
  const panelId = input.instance.resource?.metadata?.panelId;
  const panel = typeof panelId === "string" ? state.panels[panelId] : undefined;
  const view = useWorkbenchStore(input.workbench.views.store, (value) =>
    panel && panel.kind !== "schema" ? value.views[panel.viewId] : undefined,
  );
  const contentLayout = view?.body.kind === "react" || view?.body.kind === "webview" ? view.body.layout : undefined;
  const guard = settingsLeaveGuard(input.workbench);
  const draft = useSyncExternalStore(guard.subscribe, guard.getActions);
  const changes = draft
    ? { dirty: draft.dirty, saving: draft.saving, disabled: draft.disabled, onSave: draft.save, onReset: draft.reset }
    : undefined;
  const title = input.instance.resource?.label ?? panel?.title ?? "Settings";
  const [actions, setActions] = useState<HTMLDivElement | null>(null);
  const [description, setDescription] = useState<HTMLDivElement | null>(null);
  const [binding] = useState(() => ({ workbench: input.workbench, title }));
  return (
    <SettingsHeaderContext value={{ actions, description }}>
      <SettingsPageContext value={binding}>
        <SettingsPage
          title={title}
          icon={<WorkbenchIcon name={panel?.icon ?? "settings"} size="1em" />}
          changes={changes}
          headerActions={<HStack ref={setActions} gap="sm" _empty={{ display: "none" }} />}
          description={
            <Box ref={setDescription} color="fg.muted" textStyle="paragraph/S/regular" _empty={{ display: "none" }} />
          }
          contentLayout={contentLayout}
        >
          <SettingsSurfaceContent {...props} />
        </SettingsPage>
      </SettingsPageContext>
    </SettingsHeaderContext>
  );
};
