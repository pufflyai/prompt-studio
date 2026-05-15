import {
  activateProductModule,
  type ProductModuleContribution,
  type ResourceRef,
  type TreeViewSection,
} from "pstdio-shell/core";
import type { MutableRefObject } from "react";
import { createDashboardProjectShell } from "./dashboard-project-shell";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "./menu-locations";

export const SESSIONS_RESOURCE_KIND = "sessions";
export const SESSION_RESOURCE_KIND = "session";
export const SESSIONS_MODE_ID = "sessions";
export const SESSIONS_NAVIGATION_TREE_ID = "sessions.navigation";
export const SESSIONS_CHAT_WIDGET_ID = "sessions.chat";
export const SESSIONS_OPEN_COMMAND_ID = "sessions.open";
export const SESSIONS_CREATE_COMMAND_ID = "sessions.create";
export const SESSIONS_NAVIGATION_PARSER_ID = "dashboard.sessionsUri";
export const SESSIONS_NAVIGATOR_ID = "dashboard.sessionsRouter";

const SESSIONS_ICON = "MessageCircle";
const SESSION_ICON = "Terminal";
const SESSIONS_CONTRIBUTION_PRIORITY = 200;

interface CreateDashboardSessionsShellInput {
  projectId: string;
  projectName: string;
  selectedSessionId?: string | null;
  navigation: MutableRefObject<DashboardSessionsNavigationState>;
  navigate: (path: string) => void;
}

export interface DashboardSessionsNavigationState {
  getSections: () => TreeViewSection[];
}

export const createSessionsResource = (projectId: string): ResourceRef => ({
  kind: SESSIONS_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/sessions`,
  id: "sessions",
  label: "Sessions",
  icon: SESSIONS_ICON,
});

export const createSessionResource = (projectId: string, sessionId: string, label?: string): ResourceRef => ({
  kind: SESSION_RESOURCE_KIND,
  uri: `pstdio://project/${projectId}/session/${sessionId}`,
  id: sessionId,
  label: label ?? "Session",
  icon: SESSION_ICON,
});

const parseSessionsUri = (uri: string) => {
  const sessionsMatch = uri.match(/^pstdio:\/\/project\/([^/]+)\/sessions$/);
  if (sessionsMatch) return { projectId: sessionsMatch[1], sessionId: null };

  const sessionMatch = uri.match(/^pstdio:\/\/project\/([^/]+)\/session\/(.+)$/);
  if (sessionMatch) return { projectId: sessionMatch[1], sessionId: sessionMatch[2] };

  return null;
};

const createSessionsHref = (projectId: string, sessionId?: string | null) =>
  sessionId ? `/projects/${projectId}/sessions/${sessionId}` : `/projects/${projectId}/sessions`;

const hrefFromResource = (resource: ResourceRef) => {
  const parsed = parseSessionsUri(resource.uri);
  return parsed ? createSessionsHref(parsed.projectId, parsed.sessionId) : "/";
};

const createInitialSessionResource = (input: CreateDashboardSessionsShellInput) =>
  input.selectedSessionId
    ? createSessionResource(input.projectId, input.selectedSessionId)
    : createSessionsResource(input.projectId);

const createDashboardSessionsModule = (input: CreateDashboardSessionsShellInput): ProductModuleContribution => ({
  id: "dashboard.sessions",
  activate(ctx) {
    const sessionsResource = createSessionsResource(input.projectId);

    return [
      ctx.resources.registerKind({ kind: SESSIONS_RESOURCE_KIND, label: "Sessions", icon: SESSIONS_ICON }),
      ctx.resources.registerKind({ kind: SESSION_RESOURCE_KIND, label: "Session", icon: SESSION_ICON }),
      ctx.navigation.registerParser({
        id: SESSIONS_NAVIGATION_PARSER_ID,
        priority: SESSIONS_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseSessionsUri(location) !== null,
        parse: (location) => {
          const parsed = parseSessionsUri(location);
          if (!parsed) return createSessionsResource(input.projectId);

          return parsed.sessionId
            ? createSessionResource(parsed.projectId, parsed.sessionId)
            : createSessionsResource(parsed.projectId);
        },
      }),
      ctx.navigation.registerNavigator({
        id: SESSIONS_NAVIGATOR_ID,
        priority: SESSIONS_CONTRIBUTION_PRIORITY,
        canNavigate: (resource) => resource.kind === SESSIONS_RESOURCE_KIND || resource.kind === SESSION_RESOURCE_KIND,
        createHref: hrefFromResource,
        navigate: (resource) => {
          const href = hrefFromResource(resource);
          input.navigate(href);
          return href;
        },
      }),
      ctx.modes.registerMode({
        id: SESSIONS_MODE_ID,
        label: "Sessions",
        activate: (modeCtx) =>
          modeCtx.trees.registerTreeView({
            id: SESSIONS_NAVIGATION_TREE_ID,
            title: "Sessions",
            area: "left",
            areaSize: { defaultPx: 288, minPx: 240 },
            icon: SESSIONS_ICON,
            getRoots: () => [],
            getChildren: () => [],
            getSections: () => input.navigation.current.getSections(),
          }),
      }),
      ctx.layout.registerWidget({
        id: SESSIONS_CHAT_WIDGET_ID,
        title: "Sessions",
        area: "main",
        singleton: true,
        resourceKinds: [SESSIONS_RESOURCE_KIND, SESSION_RESOURCE_KIND],
        renderer: "react",
        rendererId: SESSIONS_CHAT_WIDGET_ID,
      }),
      ctx.resources.registerOpener({
        id: SESSIONS_CHAT_WIDGET_ID,
        priority: 100,
        canOpen: (resource) => resource.kind === SESSIONS_RESOURCE_KIND || resource.kind === SESSION_RESOURCE_KIND,
        open: async (resource, openInput) => {
          await ctx.navigation.navigateResource(resource);
          return ctx.layout.openWidget(SESSIONS_CHAT_WIDGET_ID, {
            resource,
            replaceActive: openInput.replaceActive,
            closable: false,
          });
        },
      }),
      ctx.commands.registerCommand(
        {
          id: SESSIONS_OPEN_COMMAND_ID,
          label: "Open sessions",
          category: "Sessions",
          description: "Open project sessions",
          icon: SESSIONS_ICON,
        },
        {
          execute: () => ctx.resources.openResource(sessionsResource),
        },
      ),
      ctx.commands.registerCommand(
        {
          id: SESSIONS_CREATE_COMMAND_ID,
          label: "New session",
          category: "Sessions",
          description: "Start a new project session",
          icon: "Plus",
        },
        {
          execute: () => ctx.resources.openResource(sessionsResource),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: SESSIONS_OPEN_COMMAND_ID,
        label: "Open sessions",
        icon: SESSIONS_ICON,
      }),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: SESSIONS_CREATE_COMMAND_ID,
        label: "New session",
        icon: "Plus",
      }),
    ];
  },
});

export const createDashboardSessionsShell = (input: CreateDashboardSessionsShellInput) => {
  const shell = createDashboardProjectShell({
    projectId: input.projectId,
    projectName: input.projectName,
    navigate: input.navigate,
  });
  const disposable = activateProductModule(shell, createDashboardSessionsModule(input));

  shell.modes.setActiveMode(SESSIONS_MODE_ID);
  shell.layout.clearArea("main");
  shell.layout.openWidget(SESSIONS_CHAT_WIDGET_ID, {
    resource: createInitialSessionResource(input),
    closable: false,
  });

  return {
    ...shell,
    dispose: () => {
      disposable.dispose();
      shell.dispose();
    },
  };
};
