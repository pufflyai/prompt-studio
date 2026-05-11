import { Flex } from "@chakra-ui/react";
import { EmptyState, ResizableSplitLayout, ThemePreferenceProvider, useThemePreference } from "@pstdio/ui";
import { Outlet, useParams, useRouterState } from "@tanstack/react-router";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { SessionAttachedPanel } from "@/features/sessions/components/session-attached-panel";
import { SessionBubbleContainer } from "@/features/sessions/components/session-bubble.container";
import { SessionChatView } from "@/features/sessions/components/session-chat-view";
import { isSessionsRoutePath } from "@/features/sessions/utils/sessions-route";
import { ShortcutProvider } from "@/features/shortcuts/shortcut-provider";
import { useDeferredMount } from "@/shared/performance/use-deferred-page-mount";
import { ProjectSettingsProvider, useProjectSettingsStore } from "@/shared/stores/project-settings";
import { mergeDashboardThemePreferences } from "../../../theme-preferences";
import { useExtensionAppearanceThemePreferences } from "../../extensions/use-extension-appearance";
import { useProject } from "../hooks/use-project";
import { shouldRenderProjectOutlet } from "./project-shell-readiness";

// createPortal unmounts its children when the target reference changes. To preserve
// SessionChatView across attach/detach toggles, we keep a single host div with a stable
// JS reference and move it between chrome slots via appendChild — React's portal never
// sees a target swap, so the chat instance stays alive.
const createChatHost = () => {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.display = "contents";
  host.dataset.sessionChatHost = "";
  return host;
};

const ProjectShellContent = () => {
  const { projectId, workspaceShorthand } = useParams({ strict: false });
  const location = useRouterState({ select: (state) => state.location });
  const { data: project, isLoading } = useProject(projectId);
  const { t } = useTranslation("projects");
  const sessionModalState = useProjectSettingsStore((s) => s.sessionModalState);
  const setSessionModalState = useProjectSettingsStore((s) => s.setSessionModalState);
  const setLastNonSessionsPath = useProjectSettingsStore((s) => s.setLastNonSessionsPath);
  const selectedSessionId = useProjectSettingsStore((s) => s.selectedSessionId);
  const setSelectedSessionId = useProjectSettingsStore((s) => s.setSelectedSessionId);
  const pendingWorkspaceSessionWorkspaceId = useProjectSettingsStore((s) => s.pendingWorkspaceSessionWorkspaceId);
  const isSessionsRoute = isSessionsRoutePath(location.pathname, projectId);
  const isWorkspaceRoute = typeof workspaceShorthand === "string" && workspaceShorthand.length > 0;
  const renderOutlet = shouldRenderProjectOutlet({
    projectId,
    hasProject: Boolean(project),
    isProjectLoading: isLoading,
  });

  const chatHostRef = useRef<HTMLDivElement | null>(null);
  if (!chatHostRef.current) chatHostRef.current = createChatHost();
  const [attachedSlot, setAttachedSlot] = useState<HTMLDivElement | null>(null);
  const [bubbleSlot, setBubbleSlot] = useState<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!projectId || isSessionsRoute) return;
    const currentPath =
      typeof window === "undefined"
        ? location.pathname
        : `${window.location.pathname}${window.location.search}${window.location.hash}`;
    setLastNonSessionsPath(currentPath);
  }, [isSessionsRoute, location.pathname, projectId, setLastNonSessionsPath]);

  const showAttachedPanel = sessionModalState === "attached" && !isSessionsRoute;
  const isBubbleMode = sessionModalState === "bubble" && !isSessionsRoute;
  const showChatView = !isSessionsRoute && (showAttachedPanel || isBubbleMode);
  const chatViewMounted = useDeferredMount(showChatView ? "visible" : "hidden");
  const activeSlot = showAttachedPanel ? attachedSlot : isBubbleMode ? bubbleSlot : null;

  useLayoutEffect(() => {
    const host = chatHostRef.current;
    if (!host) return;
    if (activeSlot) {
      if (host.parentNode !== activeSlot) activeSlot.appendChild(host);
    } else if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }, [activeSlot]);

  const content = (
    <Flex flex="1" minW={0} minH={0} overflow="hidden">
      {renderOutlet ? (
        <Outlet />
      ) : (
        <EmptyState title={t("shell.notFound")} description={t("shell.notFoundDescription")} />
      )}
    </Flex>
  );

  return (
    <Flex height="100%" width="100%" minH="0">
      <ResizableSplitLayout
        flex="1"
        minH="0"
        minW="0"
        resizableSide="right"
        contentPanel={content}
        resizablePanel={showAttachedPanel ? <SessionAttachedPanel chatSlotRef={setAttachedSlot} /> : null}
        defaultSizePx={448}
        minSizePx={320}
        contentMinSizePx={320}
        collapsed={!showAttachedPanel}
        resizeLabel="Resize attached panel"
        showResizeSeparator={false}
        onCollapsedChange={(collapsed) => {
          if (collapsed) setSessionModalState("bubble");
        }}
      />
      {!isSessionsRoute ? <SessionBubbleContainer chatSlotRef={setBubbleSlot} /> : null}
      {showChatView && chatViewMounted && chatHostRef.current
        ? createPortal(
            <SessionChatView
              sessionId={selectedSessionId}
              newSessionWorkspaceId={isWorkspaceRoute ? (pendingWorkspaceSessionWorkspaceId ?? undefined) : undefined}
              onSessionCreated={setSelectedSessionId}
              showWorkspaceHub={!isWorkspaceRoute}
              autoFocusChatInput={isBubbleMode}
            />,
            chatHostRef.current,
          )
        : null}
    </Flex>
  );
};

export const ProjectShell = () => {
  const { projectId } = useParams({ strict: false });
  const { themePreference } = useThemePreference();
  const extensionThemePreferences = useExtensionAppearanceThemePreferences(projectId);
  const themePreferences = mergeDashboardThemePreferences(extensionThemePreferences);

  return (
    <ThemePreferenceProvider initialPreference={themePreference} themePreferences={themePreferences}>
      <ProjectSettingsProvider projectId={projectId}>
        <ShortcutProvider>
          <ProjectShellContent />
        </ShortcutProvider>
      </ProjectSettingsProvider>
    </ThemePreferenceProvider>
  );
};
