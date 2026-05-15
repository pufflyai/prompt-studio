import type { ResourceRef, ShellModuleContribution, ShellModuleContributionContext } from "pstdio-shell/core";
import { workbenchCommandPaletteMenuPath } from "pstdio-shell/core";
import { createElement } from "react";
import { SELECTED_PROJECT_CONTEXT_KEY } from "../projects/constants";
import {
  SESSION_ICON,
  SESSION_OPEN_COMMAND_ID,
  SESSION_RESOURCE_KIND,
  SESSIONS_ICON,
  SESSIONS_MODULE_ID,
  SESSIONS_NAVIGATION_PARSER_ID,
  SESSIONS_NAVIGATOR_ID,
  SESSIONS_OPEN_COMMAND_ID,
  SESSIONS_RESOURCE_KIND,
  SESSIONS_WIDGET_ID,
} from "./constants";
import {
  beginSessionSwitchTrace,
  getSessionSwitchDiagnosticNow,
  recordSessionSwitchStep,
} from "./data/session-switch-diagnostics";
import { sessionsNavigationState } from "./navigation-state";
import {
  createSessionResource,
  createSessionsHref,
  createSessionsResource,
  getProjectIdFromResource,
  isSessionsResource,
  parseSessionsLocation,
} from "./resources";
import { SessionsWidget } from "./widgets/sessions-widget";

export * from "./constants";
export { sessionsNavigationState } from "./navigation-state";
export * from "./resources";
export type { SessionsNavigationController, SessionsNavigationState } from "./widgets/sessions-widget";

const navigateToHref = (href: string) => {
  if (typeof window !== "undefined" && href) {
    window.location.hash = href.slice(1);
  }

  return href;
};

const getSessionSwitchTraceInput = (resource: ResourceRef) => ({
  sessionId: resource.kind === SESSION_RESOURCE_KIND ? (resource.id ?? null) : null,
  resourceUri: resource.uri,
});

const scheduleSessionNavigation = (
  ctx: ShellModuleContributionContext,
  resource: ResourceRef,
  traceInput: ReturnType<typeof getSessionSwitchTraceInput>,
) => {
  const navigate = () => {
    const startedAt = getSessionSwitchDiagnosticNow();

    void ctx.navigation
      .navigateResource(resource)
      .then(() => {
        recordSessionSwitchStep({
          ...traceInput,
          step: "navigation.navigate",
          durationMs: getSessionSwitchDiagnosticNow() - startedAt,
        });
      })
      .catch((error: unknown) => {
        recordSessionSwitchStep({
          ...traceInput,
          step: "navigation.error",
          metadata: { message: error instanceof Error ? error.message : String(error) },
        });
      });
  };

  if (typeof window === "undefined") {
    navigate();
    return;
  }

  window.requestAnimationFrame(() => window.setTimeout(navigate, 0));
};

export const createSessionsModule = (): ShellModuleContribution => ({
  id: SESSIONS_MODULE_ID,
  activate(ctx) {
    ctx.resources.registerKind({ kind: SESSIONS_RESOURCE_KIND, label: "Sessions", icon: SESSIONS_ICON });
    ctx.resources.registerKind({ kind: SESSION_RESOURCE_KIND, label: "Session", icon: SESSION_ICON });

    ctx.navigation.registerParser({
      id: SESSIONS_NAVIGATION_PARSER_ID,
      priority: 100,
      canParse: (location) => parseSessionsLocation(location) !== null,
      parse: (location) => parseSessionsLocation(location)!,
    });

    ctx.navigation.registerNavigator({
      id: SESSIONS_NAVIGATOR_ID,
      priority: 100,
      canNavigate: isSessionsResource,
      createHref: createSessionsHref,
      navigate: (resource) => navigateToHref(createSessionsHref(resource)),
    });

    ctx.layout.registerWidget({
      id: SESSIONS_WIDGET_ID,
      title: "Sessions",
      area: "main",
      singleton: true,
      resourceKinds: [SESSIONS_RESOURCE_KIND, SESSION_RESOURCE_KIND],
      rendererId: SESSIONS_WIDGET_ID,
    });

    ctx.renderers.registerRenderer({
      id: SESSIONS_WIDGET_ID,
      render: (input) => createElement(SessionsWidget, { input, navigation: sessionsNavigationState }),
    });

    ctx.resources.registerOpener({
      id: SESSIONS_WIDGET_ID,
      priority: 100,
      canOpen: isSessionsResource,
      open: (resource, input) => {
        const projectId = getProjectIdFromResource(resource);
        if (projectId) ctx.context.set(SELECTED_PROJECT_CONTEXT_KEY, projectId);
        const traceInput = getSessionSwitchTraceInput(resource);
        beginSessionSwitchTrace({ ...traceInput, source: "resource.open" });
        const placement = ctx.layout.openWidget(SESSIONS_WIDGET_ID, { resource, replaceActive: input.replaceActive });
        recordSessionSwitchStep({
          ...traceInput,
          step: "layout.open-widget",
          metadata: { replaceActive: input.replaceActive, widgetId: placement.widgetId },
        });
        scheduleSessionNavigation(ctx, resource, traceInput);
        return placement;
      },
    });

    const getSelectedProjectId = () => {
      const value = ctx.context.get(SELECTED_PROJECT_CONTEXT_KEY);
      return typeof value === "string" ? value : null;
    };

    ctx.commands.registerCommand(
      {
        id: SESSIONS_OPEN_COMMAND_ID,
        label: "Open sessions",
        category: "Sessions",
        icon: SESSIONS_ICON,
      },
      {
        execute: () => {
          const projectId = getSelectedProjectId();
          if (!projectId) return;
          return ctx.resources.openResource(createSessionsResource(projectId));
        },
      },
    );

    ctx.menus.registerMenuAction(workbenchCommandPaletteMenuPath, {
      commandId: SESSIONS_OPEN_COMMAND_ID,
      order: 10,
    });

    ctx.commands.registerCommand(
      {
        id: SESSION_OPEN_COMMAND_ID,
        label: "Open session",
        category: "Sessions",
        icon: SESSION_ICON,
      },
      {
        execute: (sessionId: string) => {
          const projectId = getSelectedProjectId();
          if (!projectId) return;
          return ctx.resources.openResource(createSessionResource(projectId, sessionId));
        },
      },
    );
  },
});
