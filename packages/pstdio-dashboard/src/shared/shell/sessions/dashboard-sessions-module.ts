import type {
  ResourceRef,
  ShellModeContribution,
  ShellModuleContribution,
  ShellModuleContributionContext,
  TreeViewSection,
} from "pstdio-shell/core";
import { PROJECT_CONTEXT_WHEN, PROJECT_NAVIGATION_HEADER_WIDGET_ID } from "../dashboard-project-chrome";
import { DASHBOARD_COMMAND_PALETTE_MENU } from "../menu-locations";

export const SESSIONS_RESOURCE_KIND = "sessions";
export const SESSION_RESOURCE_KIND = "session";
export const PROJECT_SESSIONS_MODE_ID = "project.sessions";
export const SESSIONS_NAVIGATION_TREE_ID = "sessions.navigation";
export const SESSIONS_CHAT_WIDGET_ID = "sessions.chat";
export const SESSIONS_OPEN_COMMAND_ID = "sessions.open";
export const SESSIONS_CREATE_COMMAND_ID = "sessions.create";
export const SESSIONS_NAVIGATION_PARSER_ID = "dashboard.sessionsUri";
export const SESSIONS_NAVIGATOR_ID = "dashboard.sessionsRouter";

const SESSIONS_ICON = "MessageCircle";
const SESSION_ICON = "Terminal";
const SESSIONS_CONTRIBUTION_PRIORITY = 200;

export interface DashboardSessionsNavigationState {
  getSections: () => TreeViewSection[];
}

export interface DashboardSessionsNavigationController {
  current: DashboardSessionsNavigationState;
}

interface CreateDashboardSessionsModuleInput {
  navigate: (path: string) => void;
}

const readContextString = (ctx: ShellModuleContributionContext, key: string) => {
  const value = ctx.context.get(key);
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const readProjectId = (ctx: ShellModuleContributionContext) => readContextString(ctx, "projectId") ?? "";

const readSessionId = (ctx: ShellModuleContributionContext) => readContextString(ctx, "sessionId");

export const createEmptySessionsNavigationState = (): DashboardSessionsNavigationState => ({
  getSections: () => [],
});

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

const createActiveSessionResource = (ctx: ShellModuleContributionContext) => {
  const projectId = readProjectId(ctx);
  const sessionId = readSessionId(ctx);
  return sessionId ? createSessionResource(projectId, sessionId) : createSessionsResource(projectId);
};

export const createDashboardSessionsModule = (input: CreateDashboardSessionsModuleInput): ShellModuleContribution => ({
  id: "dashboard.sessions",
  activate(ctx) {
    return [
      ctx.resources.registerKind({ kind: SESSIONS_RESOURCE_KIND, label: "Sessions", icon: SESSIONS_ICON }),
      ctx.resources.registerKind({ kind: SESSION_RESOURCE_KIND, label: "Session", icon: SESSION_ICON }),
      ctx.navigation.registerParser({
        id: SESSIONS_NAVIGATION_PARSER_ID,
        priority: SESSIONS_CONTRIBUTION_PRIORITY,
        canParse: (location) => parseSessionsUri(location) !== null,
        parse: (location) => {
          const parsed = parseSessionsUri(location);
          if (!parsed) return createActiveSessionResource(ctx);

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
          execute: () => ctx.resources.openResource(createSessionsResource(readProjectId(ctx))),
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
          execute: () => ctx.resources.openResource(createSessionsResource(readProjectId(ctx))),
        },
      ),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: SESSIONS_OPEN_COMMAND_ID,
        label: "Open sessions",
        icon: SESSIONS_ICON,
        when: PROJECT_CONTEXT_WHEN,
      }),
      ctx.menus.registerMenuAction(DASHBOARD_COMMAND_PALETTE_MENU, {
        commandId: SESSIONS_CREATE_COMMAND_ID,
        label: "New session",
        icon: "Plus",
        when: PROJECT_CONTEXT_WHEN,
      }),
    ];
  },
});

export const createProjectSessionsMode = (input: {
  navigation: DashboardSessionsNavigationController;
}): ShellModeContribution => ({
  id: PROJECT_SESSIONS_MODE_ID,
  label: "Sessions",
  activate(ctx) {
    ctx.layout.clearArea("left-header");
    ctx.layout.clearArea("main");
    ctx.layout.openWidget(PROJECT_NAVIGATION_HEADER_WIDGET_ID, {
      closable: false,
      pinned: true,
    });
    ctx.layout.openWidget(SESSIONS_CHAT_WIDGET_ID, {
      resource: createActiveSessionResource(ctx),
      closable: false,
    });

    return ctx.trees.registerTreeView({
      id: SESSIONS_NAVIGATION_TREE_ID,
      title: "Sessions",
      area: "left",
      areaSize: { defaultPx: 288, minPx: 240 },
      icon: SESSIONS_ICON,
      getRoots: () => [],
      getChildren: () => [],
      getSections: () => input.navigation.current.getSections(),
    });
  },
});
