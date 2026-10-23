import { Center, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { getThemePreferenceMode, toaster, useThemePreference } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelInstance, WorkbenchTerminalController } from "@pstdio/workbench";
import { createExtensionWebviewHostCapabilities } from "@pstdio/workbench/extensions";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-webview-path";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { buildAbsoluteApiUrl, getApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { useActionError } from "@/shared/components/use-action-error";
import { getExtensionTranslationContext, resolveLocalizableString } from "@/shared/extensions/extension-localization";
import {
  type ExtensionCommandEvent,
  publishExtensionCommandEvent,
  subscribeToExtensionCommandFeed,
} from "../extension-webview-broadcast";
import { createDashboardExtensionWebviewAdapters } from "../extension-webview-capabilities";
import { subscribeWebviewExtensionEvents } from "../extension-webview-events";
import { openExtensionViews } from "../open-extension-views";
import { usePausedExtensions } from "../paused-extensions";
import { useExecuteExtensionCommand, useProjectExtensions } from "../use-project-extensions";
import { useWebviewPageProps } from "../use-webview-page-props";
import { createDashboardOwnedPreferences } from "../webview-owned-preferences";
import {
  createDashboardWebviewNotificationsAdapter,
  createDashboardWebviewSettingsAdapter,
} from "../webview-service-adapters";
import { executeWebviewCommand, webviewCommandSlot } from "./extension-webview-command";
import { BridgedWebviewSurface, StaticWebviewSurface, type WebviewDescriptor } from "./extension-webview-surfaces";
import { PausedExtensionView } from "./paused-extension-view";

interface ExtensionWebviewFrameProps {
  sizing?: "content-width" | "content-height";
  extensionId: string;
  extensionInstanceId?: string;
  installName?: string;
  projectId: string | undefined;
  resource?: ResourceRef;
  placement?: WorkbenchPanelInstance;
  terminal?: WorkbenchTerminalController;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
  slotKind?: "panel" | "settings";
  workbench?: WorkbenchCore;
}

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? "en";
export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const owner = getRuntimeCollections();
  const { extensionId, extensionInstanceId, installName, projectId, resource, terminal, title, webview, webviewId } =
    props;
  const { themePreference, themePreferences } = useThemePreference();
  const { showError, errorNotice, clearError } = useActionError();
  const executeCommand = useExecuteExtensionCommand(projectId, (notice) => {
    if (notice.type === "error" || notice.type === "warning") showError(notice);
    else toaster.create(notice);
  });
  const [hostEvents] = useState(createHostEventPublisher);
  const { pageLocation, pageParams } = useWebviewPageProps(props.workbench);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);
  const [locale, setLocale] = useState(currentLocale);
  const paused = usePausedExtensions();
  const projectExtensions = useProjectExtensions(projectId);
  const installedExtensionId = webview?.runtimeUrl
    ? parseExtensionWebviewPath(webview.runtimeUrl)?.scope.installedExtensionId
    : undefined;
  const isPaused = installedExtensionId ? paused.has(installedExtensionId) : false;
  const loads = Boolean(webview?.runtimeUrl && webview.moduleUrl);
  // The performance popover lists every extension with a loaded view.
  useEffect(() => {
    if (!installedExtensionId || isPaused || !loads) return;
    return openExtensionViews.open(installedExtensionId, webviewId);
  }, [installedExtensionId, webviewId, isPaused, loads]);

  useEffect(() => subscribeToExtensionCommandFeed((event) => setLastCommand(event)), []);
  useEffect(() => subscribeWebviewExtensionEvents(hostEvents, projectId), [hostEvents, projectId]);
  useEffect(() => {
    const onLanguageChanged = () => setLocale(currentLocale());
    i18n.on("languageChanged", onLanguageChanged);
    return () => i18n.off("languageChanged", onLanguageChanged);
  }, []);

  if (!webview) return null;

  const colorScheme = getThemePreferenceMode(themePreference, themePreferences);
  const frameTitle = webview.title ? resolveLocalizableString(webview.title, extensionId) : (title ?? "Extension view");
  const translations = getExtensionTranslationContext(extensionId, locale);

  const capabilities = createExtensionWebviewHostCapabilities(
    createDashboardExtensionWebviewAdapters({
      base: {
        hostEvents,
        terminal,
        executeCommand: (commandInput, signal) => {
          clearError();
          return executeWebviewCommand({
            ...commandInput,
            placement: props.placement?.placementIdentity,
            signal,
            resource: commandInput.resource ?? resource ?? props.placement?.resource,
            slot: webviewCommandSlot({ projectId, webviewId, slotKind: props.slotKind }),
            workbench: props.workbench,
            projectId,
            executeExtensionCommand: (input) =>
              executeCommand.mutateAsync({
                signal,
                commandId: input.commandId,
                body: {
                  metadata: input.metadata,
                  params: input.params,
                  workspaceId: input.workspaceId,
                  resource: input.resource,
                  slot: input.slot,
                  source: "dashboard",
                },
              }),
          });
        },
        streamCommand: projectId
          ? (input, signal) => {
              const { commandId, ...body } = input;
              return getApiClient().extensions.stream(
                commandId,
                { ...body, projectId, source: "dashboard" },
                { signal },
              );
            }
          : undefined,
        commandCompleted: (response) => publishExtensionCommandEvent(response, { projectId }, owner),
        settings: createDashboardWebviewSettingsAdapter({ projectId, extensionInstanceId, installName }),
        notifications: createDashboardWebviewNotificationsAdapter({ projectId, extensionId, showError }),
      },
      extensionId,
      extensionInstanceId,
      projectId,
      webviewId,
      workbench: props.workbench,
      placement: props.placement,
      ownedPreferences: createDashboardOwnedPreferences({ projectId, instanceId: extensionInstanceId, installName }),
    }),
  );

  if (!webview.runtimeUrl || !webview.moduleUrl) {
    if (!webview.assetUrl) {
      return (
        <Center px="md" color="fg.muted">
          <Text textStyle="paragraph/S/regular">Extension view is still building...</Text>
        </Center>
      );
    }

    return <StaticWebviewSurface key={webviewId} colorScheme={colorScheme} title={frameTitle} webview={webview} />;
  }

  // A paused extension's frames unmount, so Chromium ends its renderer process.
  if (installedExtensionId && isPaused) {
    const extensionName =
      projectExtensions.data?.extensions.find((extension) => extension.installedExtensionId === installedExtensionId)
        ?.displayName ?? frameTitle;
    return <PausedExtensionView installedExtensionId={installedExtensionId} name={extensionName} />;
  }

  const view = {
    id: webviewId,
    extensionId,
    label: frameTitle,
    webview: {
      moduleUrl: buildAbsoluteApiUrl(webview.moduleUrl),
      capabilities: webview.capabilities,
      styles: (webview.styles ?? []).map((styleUrl) => buildAbsoluteApiUrl(styleUrl)),
      runtimeUrl: buildAbsoluteApiUrl(webview.runtimeUrl),
    },
  };

  return (
    <>
      {errorNotice}
      <BridgedWebviewSurface
        workbench={props.workbench}
        sizing={props.sizing}
        key={view.id}
        view={view}
        extensionProps={{
          projectId,
          themePreference,
          locale,
          lastCommand,
          resource,
          pageLocation,
          viewLocation: {
            section: props.placement?.section,
            position: props.placement?.position,
            pageContext: props.placement?.pageContext,
          },
          pageParams,
          translations,
        }}
        theme={colorScheme}
        capabilities={capabilities}
        hostEvents={hostEvents}
      />
    </>
  );
};
