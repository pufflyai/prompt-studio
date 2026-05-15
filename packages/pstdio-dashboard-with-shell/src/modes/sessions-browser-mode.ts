import type { Disposable, ShellModeActivationContext, ShellModeContribution } from "pstdio-shell/core";
import { PROJECT_SELECTOR_WIDGET_ID, SELECTED_PROJECT_CONTEXT_KEY } from "../modules/projects/constants";
import { SESSIONS_ICON, SESSIONS_NAVIGATION_TREE_ID, SESSIONS_WIDGET_ID } from "../modules/sessions/constants";
import { recordSessionSwitchStep } from "../modules/sessions/data/session-switch-diagnostics";
import { sessionsNavigationState } from "../modules/sessions/navigation-state";
import { createSessionsResource, getProjectIdFromResource, parseSessionsLocation } from "../modules/sessions/resources";
import { MODE_SWITCHER_WIDGET_ID, SESSIONS_BROWSER_MODE_ID, sessionsBrowserMode } from "./constants";

const getSelectedProjectId = (ctx: ShellModeActivationContext) => {
  const value = ctx.context.get(SELECTED_PROJECT_CONTEXT_KEY);
  return typeof value === "string" ? value : null;
};

export const shouldOpenSessionsLocationResource = (input: {
  currentResourceUri?: string | null;
  nextResourceUri?: string | null;
}) => Boolean(input.nextResourceUri && input.currentResourceUri !== input.nextResourceUri);

const openResourceFromLocation = (ctx: ShellModeActivationContext) => {
  if (typeof window === "undefined") return;
  const resource = parseSessionsLocation(window.location.hash);
  if (!resource) return;
  const projectId = getProjectIdFromResource(resource);
  if (projectId) ctx.context.set(SELECTED_PROJECT_CONTEXT_KEY, projectId);
  if (
    !shouldOpenSessionsLocationResource({
      currentResourceUri: ctx.layout.getLayout().activeResourceUri,
      nextResourceUri: resource.uri,
    })
  ) {
    return;
  }
  recordSessionSwitchStep({
    sessionId: resource.id ?? null,
    resourceUri: resource.uri,
    source: "location",
    step: "location.open",
  });
  const placement = ctx.layout.openWidget(SESSIONS_WIDGET_ID, { resource });
  recordSessionSwitchStep({
    sessionId: resource.id ?? null,
    resourceUri: resource.uri,
    source: "location",
    step: "location.open-widget",
    metadata: { widgetId: placement.widgetId },
  });
};

// Falls back to the selected project's sessions root when no session URL is present.
const openSessionsRootForSelectedProject = (ctx: ShellModeActivationContext) => {
  if (typeof window !== "undefined" && parseSessionsLocation(window.location.hash)) return;
  const projectId = getSelectedProjectId(ctx);
  if (!projectId) return;
  void ctx.resources.openResource(createSessionsResource(projectId));
};

const activateSessionsBrowser = (ctx: ShellModeActivationContext): Disposable[] => {
  ctx.layout.openWidget(MODE_SWITCHER_WIDGET_ID, { pinned: true });
  ctx.layout.openWidget(PROJECT_SELECTOR_WIDGET_ID, { pinned: true });

  const disposables: Disposable[] = [
    ctx.trees.registerTreeView({
      id: SESSIONS_NAVIGATION_TREE_ID,
      title: "Sessions",
      area: "left",
      areaSize: { defaultPx: 288, minPx: 240 },
      icon: SESSIONS_ICON,
      getRoots: () => [],
      getChildren: () => [],
      getSections: () => sessionsNavigationState.current.getSections(),
    }),
  ];

  openResourceFromLocation(ctx);
  openSessionsRootForSelectedProject(ctx);

  const unsubscribeContext = ctx.context.store.subscribe(() => openSessionsRootForSelectedProject(ctx));
  disposables.push({ dispose: unsubscribeContext });

  if (typeof window !== "undefined") {
    const handleHashChange = () => openResourceFromLocation(ctx);
    window.addEventListener("hashchange", handleHashChange);
    disposables.push({ dispose: () => window.removeEventListener("hashchange", handleHashChange) });
  }

  return disposables;
};

export const createSessionsBrowserMode = (): ShellModeContribution => ({
  id: SESSIONS_BROWSER_MODE_ID,
  label: sessionsBrowserMode.label,
  activate: activateSessionsBrowser,
});
