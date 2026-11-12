import { Center, Text } from "@chakra-ui/react";
import type { ResourceRef } from "@pstdio/sdk/extensions";
import { getThemePreferenceMode, useThemePreference, useToaster } from "@pstdio/ui";
import type { WorkbenchCore, WorkbenchPanelInstance, WorkbenchTerminalController } from "@pstdio/workbench";
import {
  createExtensionWebviewHostCapabilities,
  getBridgeWebviewHostEventPublisher,
} from "@pstdio/workbench/extensions";
import type { NativeDocumentTarget } from "pstdio-api-contracts";
import { parseExtensionWebviewPath } from "pstdio-api-contracts/extension-webview-path";
import { createHostEventPublisher } from "pstdio-extensions/bridge/host";
import { useEffect, useState } from "react";
import i18n from "@/i18n";
import { buildAbsoluteApiUrl, getApiClient } from "@/lib/api";
import { getRuntimeCollections } from "@/lib/sync/collections";
import { getPerformanceDiagnosticsAdapter } from "@/shared/app/performance-diagnostics";
import { useActionError } from "@/shared/components/use-action-error";
import { getExtensionTranslationContext, resolveLocalizableString } from "@/shared/extensions/extension-localization";
import {
  type ExtensionCommandEvent,
  publishExtensionCommandEvent,
  subscribeToExtensionCommandFeed,
} from "../extension-webview-broadcast";
import { createDashboardExtensionWebviewAdapters } from "../extension-webview-capabilities";
import { subscribeWebviewExtensionEvents } from "../extension-webview-events";
import { usePausedExtensions } from "../paused-extensions";
import { useExecuteExtensionCommand, useProjectExtensions } from "../use-project-extensions";
import { useDashboardQueryScope } from "../use-query-scope";
import { useWebviewPageProps } from "../use-webview-page-props";
import { createDashboardWebviewCommandQueries } from "../webview-command-queries";
import { createDashboardOwnedPreferences } from "../webview-owned-preferences";
import { authorizedWebviewQuerySeeds } from "../webview-query-seeds";
import {
  createDashboardWebviewNotificationsAdapter,
  createDashboardWebviewSettingsAdapter,
} from "../webview-service-adapters";
import { createDashboardWebviewServiceQueries } from "../webview-service-queries";
import { executeWebviewCommand, webviewCommandSlot } from "./extension-webview-command";
import { BridgedWebviewSurface, StaticWebviewSurface, type WebviewDescriptor } from "./extension-webview-surfaces";
import { PausedExtensionView } from "./paused-extension-view";

interface ExtensionWebviewFrameProps {
  visible?: boolean;
  sizing?: "content-width" | "content-height";
  extensionId: string;
  extensionInstanceId?: string;
  installName?: string;
  projectId: string | undefined;
  resource?: ResourceRef;
  placement?: WorkbenchPanelInstance;
  textTarget?: NativeDocumentTarget;
  terminal?: WorkbenchTerminalController;
  title?: string;
  webview?: WebviewDescriptor;
  webviewId: string;
  slotKind?: "panel" | "settings";
  workbench?: WorkbenchCore;
}

const webviewOwnerKey = (props: ExtensionWebviewFrameProps, installedExtensionId?: string) =>
  JSON.stringify([
    props.projectId,
    props.extensionId,
    props.extensionInstanceId,
    installedExtensionId,
    props.webviewId,
    props.webview?.runtimeUrl,
    props.webview?.moduleUrl,
  ]);

const currentLocale = () => i18n.resolvedLanguage ?? i18n.language ?? "en";
export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const toaster = useToaster();
  const owner = getRuntimeCollections();
  const queryScope = useDashboardQueryScope();
  const { extensionId, extensionInstanceId, installName, projectId, resource, terminal, title, webview, webviewId } =
    props;
  const { themePreference, themePreferences } = useThemePreference();
  const { showError, errorNotice, clearError } = useActionError();
  const executeCommand = useExecuteExtensionCommand(projectId, (notice) => {
    if (notice.type === "error" || notice.type === "warning") showError(notice);
    else toaster.create(notice);
  });
  const [fallbackHostEvents] = useState(createHostEventPublisher);
  const hostEvents =
    props.workbench && props.placement
      ? getBridgeWebviewHostEventPublisher(props.workbench, props.placement, projectId)
      : fallbackHostEvents;
  const { pageLocation, pageParams } = useWebviewPageProps(props.workbench, props.placement);
  const [lastCommand, setLastCommand] = useState<ExtensionCommandEvent | null>(null);
  const [locale, setLocale] = useState(currentLocale);
  const paused = usePausedExtensions();
  const projectExtensions = useProjectExtensions(projectId);
  const installedExtensionId = webview?.runtimeUrl
    ? parseExtensionWebviewPath(webview.runtimeUrl)?.scope.installedExtensionId
    : undefined;
  const isPaused = installedExtensionId ? paused.has(installedExtensionId) : false;
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
  const commandQueries = projectId
    ? createDashboardWebviewCommandQueries({
        runtime: owner,
        queryScope,
        projectId,
        extensionId,
        extensionInstanceId,
        webviewId,
        source: [installedExtensionId, webview.runtimeUrl, webview.moduleUrl],
        slotKind: props.slotKind,
        resource: resource ?? props.placement?.resource,
        workbench: props.workbench,
        placement: props.placement,
        events: hostEvents,
      })
    : undefined;

  const serviceQueries = createDashboardWebviewServiceQueries({
    workbench: props.workbench,
    runtime: owner,
    projectId,
    queryScope,
    extensionId,
    source: [extensionInstanceId, installedExtensionId, webview.runtimeUrl, webview.moduleUrl],
    events: hostEvents,
    performance: props.workbench ? getPerformanceDiagnosticsAdapter(props.workbench.settings) : undefined,
  });

  const adapters = createDashboardExtensionWebviewAdapters({
    base: {
      commandQueries,
      accountQueries: serviceQueries.account,
      performanceQueries: serviceQueries.performance,
      hostEvents,
      terminal,
      executeCommand: (commandInput, signal, invocation) => {
        clearError();
        return executeWebviewCommand({
          ...commandInput,
          placement: props.placement?.placementIdentity,
          isViewerCurrent: invocation?.isViewerCurrent,
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
            return getApiClient().extensions.stream(commandId, { ...body, projectId, source: "dashboard" }, { signal });
          }
        : undefined,
      commandCompleted: (response) => publishExtensionCommandEvent(response, { projectId }, owner),
      settings: createDashboardWebviewSettingsAdapter({ projectId, extensionInstanceId, installName }),
      notifications: createDashboardWebviewNotificationsAdapter({
        projectId,
        extensionId,
        showError,
        showNotice: (notice) => toaster.create(notice),
      }),
    },
    queryAuthority: { id: JSON.stringify(queryScope), assertCurrent: serviceQueries.requireCurrent },
    extensionId,
    extensionInstanceId,
    projectId,
    webviewId,
    workbench: props.workbench,
    placement: props.placement,
    textTarget: props.textTarget,
    ownedPreferences: createDashboardOwnedPreferences({
      runtime: owner,
      projectId,
      instanceId: extensionInstanceId,
      installName,
    }),
  });
  const capabilities = createExtensionWebviewHostCapabilities(adapters, webviewOwnerKey(props, installedExtensionId));

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
        visible={props.visible}
        workbench={props.workbench}
        sizing={props.sizing}
        key={view.id}
        view={view}
        extensionProps={{
          projectId,
          queryScope,
          ...authorizedWebviewQuerySeeds({
            declared: webview.capabilities,
            capabilities,
            commands: commandQueries?.seeds,
            account: serviceQueries.account.seeds,
            performance: serviceQueries.performance?.seeds,
            preferences: adapters.preferenceQueries?.seeds,
          }),
          presentation: props.workbench?.layout
            .getLayout()
            .regions.overlay.widgets.some((item) => item.widgetId === props.placement?.instanceId)
            ? "dialog"
            : undefined,
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
