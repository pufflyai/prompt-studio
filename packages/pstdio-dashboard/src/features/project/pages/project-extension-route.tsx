import { Center, Text } from "@chakra-ui/react";
import { useThemePreference } from "@pstdio/ui";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { ExtensionRouteRecord } from "pstdio-api-contracts";
import { ShellWorkbench } from "pstdio-shell/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { buildApiUrl } from "@/lib/api";
import {
  type ExtensionCommandEvent,
  subscribeToExtensionCommandFeed,
} from "@/shared/extensions/extension-webview-broadcast";
import {
  useExecuteExtensionCommand,
  useProjectExtensionMetadata,
} from "@/shared/extensions/hooks/use-project-extensions";
import { createDashboardExtensionWebviewHostCapabilities } from "@/shared/extensions/webview-host-adapters";
import {
  createDashboardExtensionRouteShell,
  EXTENSION_ROUTE_TREE_ID,
} from "@/shared/shell/dashboard-extension-route-shell";
import { useShell } from "@/shared/shell/use-shell";
import { useProject } from "../hooks/use-project";

interface ExtensionRouteHostDeps {
  executeCommand: (input: { commandId: string; body: unknown }) => Promise<unknown>;
  lastCommand: ExtensionCommandEvent | null;
  navigate: (options: { to: string }) => void;
  routes: ExtensionRouteRecord[];
  setThemePreference: (preference: string) => void;
  themePreference: string;
}

interface ProjectExtensionShellViewProps {
  projectId: string;
  projectName: string;
  route: ExtensionRouteRecord;
  routes: ExtensionRouteRecord[];
}

const ProjectExtensionShellView = (props: ProjectExtensionShellViewProps) => {
  const { projectId, projectName, route, routes } = props;
  const navigate = useNavigate();
  const { themePreference, setThemePreference } = useThemePreference();
  const executeCommand = useExecuteExtensionCommand(projectId);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);

  // Forward host-side extension command outcomes into the guest through `createWebviewProps`.
  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);

  // The shell is built once; these deps change every render, so the capability and props
  // factories below read from this ref instead of capturing stale values.
  const hostDeps: ExtensionRouteHostDeps = {
    executeCommand: (input) => executeCommand.mutateAsync(input),
    lastCommand,
    navigate: (options) => navigate(options),
    routes,
    setThemePreference,
    themePreference,
  };
  const hostDepsRef = useRef(hostDeps);
  hostDepsRef.current = hostDeps;

  const shell = useShell(() =>
    createDashboardExtensionRouteShell({
      projectId,
      projectName,
      route,
      getRoutes: () => hostDepsRef.current.routes,
      navigate: (path) => hostDepsRef.current.navigate({ to: path }),
      resolveAssetUrl: buildApiUrl,
      createWebviewHostCapabilities: () =>
        createDashboardExtensionWebviewHostCapabilities({
          executeCommand: (input) => hostDepsRef.current.executeCommand(input),
          navigate: (options) => hostDepsRef.current.navigate(options),
          projectId,
          setThemePreference: (preference) => hostDepsRef.current.setThemePreference(preference),
          themePreference: hostDepsRef.current.themePreference,
        }),
      createWebviewProps: () => ({
        lastCommand: hostDepsRef.current.lastCommand,
        projectId,
        themePreference: hostDepsRef.current.themePreference,
      }),
    }),
  );

  useEffect(() => {
    const subscription = shell.breadcrumbs.setItems([{ title: projectName }, { title: route.label }]);
    return () => subscription.dispose();
  }, [shell, projectName, route.label]);

  useEffect(() => {
    if (routes.length === 0) return;
    shell.trees.refresh(EXTENSION_ROUTE_TREE_ID);
  }, [shell, routes]);

  return <ShellWorkbench shell={shell} />;
};

const ExtensionRouteFallback = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <Center h="full" color="fg.muted" p="md">
      <Text textStyle="paragraph/S/regular">{children}</Text>
    </Center>
  );
};

export const ProjectExtensionRoute = () => {
  const { projectId, extensionRoutePath } = useParams({ strict: false });
  const { data: project } = useProject(projectId);
  const { data, isLoading } = useProjectExtensionMetadata(projectId);
  const routes = data?.routes ?? [];
  const route = routes.find((item) => item.path === extensionRoutePath) ?? null;

  if (isLoading) {
    return <ExtensionRouteFallback>Loading extension view...</ExtensionRouteFallback>;
  }

  if (!projectId || !route) {
    return <ExtensionRouteFallback>Extension view not found.</ExtensionRouteFallback>;
  }

  return (
    <ProjectExtensionShellView
      key={route.id}
      projectId={projectId}
      projectName={project?.name ?? "Project"}
      route={route}
      routes={routes}
    />
  );
};
