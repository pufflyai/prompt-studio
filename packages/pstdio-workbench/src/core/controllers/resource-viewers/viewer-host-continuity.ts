import type { WorkbenchWidgetPlacement } from "../../registries/layout/layout-types";
import type { WorkbenchCore } from "../../workbench-core-types";

interface ViewerHosts {
  keys: Map<string, string>;
  retired: Set<string>;
  next: number;
}
const hosts = new WeakMap<WorkbenchCore, ViewerHosts>();
const viewerHosts = (core: WorkbenchCore) => {
  let state = hosts.get(core);
  if (!state) {
    state = { keys: new Map(), retired: new Set(), next: 0 };
    hosts.set(core, state);
  }
  return state;
};

export const viewerHostKey = (core: WorkbenchCore, widgetId: string) => {
  const state = viewerHosts(core);
  let key = state.keys.get(widgetId);
  if (!key) {
    key = `viewer-host:${state.next++}`;
    state.keys.set(widgetId, key);
  }
  return key;
};

export const isRetiredViewerHost = (core: WorkbenchCore, widgetId: string) => viewerHosts(core).retired.has(widgetId);
export const reopenViewerHost = (core: WorkbenchCore, widgetId: string) => viewerHosts(core).retired.delete(widgetId);
export const releaseViewerHosts = (core: WorkbenchCore, retained: ReadonlySet<string>) => {
  const state = viewerHosts(core);
  const open = core.host.getOpenPlacementIds();
  for (const id of state.keys.keys()) if (!retained.has(id) && !open.has(id)) state.keys.delete(id);
  for (const id of state.retired) if (!retained.has(id) && !open.has(id)) state.retired.delete(id);
};

export const replaceViewerHost = (
  core: WorkbenchCore,
  source: WorkbenchWidgetPlacement | undefined,
  destination: WorkbenchWidgetPlacement | undefined,
) => {
  if (!source?.viewId || source.viewId !== destination?.viewId || source.widgetId === destination.widgetId) return;
  const state = viewerHosts(core);
  const key = viewerHostKey(core, source.widgetId);
  state.keys.delete(source.widgetId);
  state.retired.add(source.widgetId);
  state.keys.set(destination.widgetId, key);
  state.retired.delete(destination.widgetId);
};
