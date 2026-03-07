import {
  createRootRoute,
  createRoute,
  createRouter,
  Navigate,
  Outlet,
  RouterProvider,
  redirect,
  useParams,
} from "@tanstack/react-router";
import { Layout } from "@/components/layout";
import { isOnboardingComplete } from "@/features/agents/agent-storage";
import { ChangelogPanel } from "@/features/changelog/pages/changelog-panel";
import { DocsPanel } from "@/features/documentation/pages/docs-panel";
import { Onboarding } from "@/features/onboarding/pages/onboarding";
import { ProjectShell } from "@/features/project/pages/project-shell";
import { ProjectList } from "@/features/project-list/pages/project-list";
import { ProjectSettings } from "@/features/project-settings/pages/project-settings";
import { SessionsPanel } from "@/features/sessions/pages/sessions-panel";
import { Settings } from "@/features/settings/pages/settings-index";
import { TicketDetailsPanel } from "@/features/ticket/pages/ticket-details-panel";
import { TicketsPanel } from "@/features/ticket-list/pages/tickets-panel";
import { WorkspaceProvider } from "@/features/workspaces/state";
import { WorkspacePage } from "@/features/workspaces-new/pages/workspace-page";

const validateDocsSearch = (search: Record<string, unknown>) => ({
  doc: typeof search.doc === "string" ? search.doc : undefined,
});

const requireOnboardingComplete = () => {
  if (!isOnboardingComplete()) {
    throw redirect({ to: "/onboarding" });
  }
};

export const resolveProjectDefaultPath = (projectId?: string) => {
  if (!projectId) {
    return "/projects";
  }

  return `/projects/${projectId}/tickets`;
};

export const AppLayout = () => {
  return (
    <WorkspaceProvider>
      <Layout />
    </WorkspaceProvider>
  );
};

const rootRoute = createRootRoute({
  component: AppLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
  component: Outlet,
});

const ProjectIndexRedirect = () => {
  const { projectId } = useParams({ strict: false });

  return <Navigate to={resolveProjectDefaultPath(projectId)} />;
};

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "projects",
  beforeLoad: requireOnboardingComplete,
  component: Outlet,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  beforeLoad: requireOnboardingComplete,
  component: Settings,
});

const docsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "docs",
  validateSearch: validateDocsSearch,
  component: DocsPanel,
});

const onboardingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "onboarding",
  beforeLoad: () => {
    if (isOnboardingComplete()) {
      throw redirect({ to: "/projects" });
    }
  },
  component: Onboarding,
});

const projectsIndexRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: "/",
  component: ProjectList,
});

const projectRoute = createRoute({
  getParentRoute: () => projectsRoute,
  path: "$projectId",
  validateSearch: (search) => ({
    panel: typeof search.panel === "string" ? search.panel : undefined,
  }),
  component: ProjectShell,
});

const projectIndexRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "/",
  component: ProjectIndexRedirect,
});

const projectTicketsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "tickets",
  component: TicketsPanel,
});

const projectDocsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "docs",
  validateSearch: validateDocsSearch,
  component: DocsPanel,
});

const projectTicketRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "tickets/$ticketShorthand",
  component: TicketDetailsPanel,
});

const projectChangelogRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "changelog",
  component: ChangelogPanel,
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "settings",
  component: ProjectSettings,
});

const projectSessionsRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "sessions",
  component: SessionsPanel,
});

const projectSessionRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "sessions/$sessionId",
  component: SessionsPanel,
});

const projectTicketWorkspaceRoute = createRoute({
  getParentRoute: () => projectRoute,
  path: "tickets/$ticketShorthand/workspaces/$workspaceShorthand",
  component: WorkspacePage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  beforeLoad: () => {
    throw redirect({ to: "/projects" });
  },
  component: Outlet,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  settingsRoute,
  docsRoute,
  onboardingRoute,
  projectsRoute.addChildren([
    projectsIndexRoute,
    projectRoute.addChildren([
      projectIndexRoute,
      projectTicketsRoute,
      projectTicketRoute,
      projectTicketWorkspaceRoute,
      projectDocsRoute,
      projectChangelogRoute,
      projectSettingsRoute,
      projectSessionsRoute,
      projectSessionRoute,
    ]),
  ]),
  notFoundRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
});

export const Router = () => {
  return <RouterProvider router={router} />;
};
