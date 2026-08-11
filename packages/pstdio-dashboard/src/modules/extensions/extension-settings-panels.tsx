import type { Disposable, WorkbenchModuleContext } from "@pstdio/workbench";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

// Extension-contributed sections sort after the host's Workbench (10) and Project (20).
const EXTENSION_SECTION_BASE_ORDER = 30;
const EXTENSION_PANEL_BASE_ORDER = 60;

// Surfaces extension-contributed settings panels (e.g. ticket statuses / tags) in the
// dashboard settings tree, rendering each as its bridged webview. An extension can
// declare its own sections and point panels at them; panels without one fall back to
// the host's Project or Workbench section for their scope.
export const registerExtensionSettingsPanels = (
  ctx: WorkbenchModuleContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const { metadata, projectId } = input;
  const disposables: Disposable[] = [];
  const ownSectionIds = new Set<string>();

  metadata.settingsSections?.forEach((section, index) => {
    disposables.push(
      ctx.settings.registerSection({
        id: section.id,
        title: resolveLocalizableString(section.title, section.extensionId),
        scope: section.scope === "global" ? "global" : "project",
        order: section.order ?? EXTENSION_SECTION_BASE_ORDER + index,
      }),
    );
    ownSectionIds.add(section.id);
  });

  metadata.settingsPanels?.forEach((panel, index) => {
    const scope = panel.scope === "global" ? "global" : "project";
    const title = resolveLocalizableString(panel.title, panel.extensionId);
    const section =
      panel.section && ownSectionIds.has(panel.section) ? panel.section : scope === "global" ? "workbench" : "project";
    disposables.push(
      ctx.settings.registerPanel({
        kind: "custom",
        id: panel.id,
        title,
        section,
        scope,
        order: EXTENSION_PANEL_BASE_ORDER + index,
        icon: panel.icon ?? "Sliders",
        render: () => (
          <ExtensionWebviewFrame
            extensionId={panel.extensionId}
            extensionInstanceId={panel.extensionInstanceId}
            installName={panel.installName}
            projectId={projectId}
            webview={panel.webview}
            webviewId={panel.id}
            title={title}
          />
        ),
      }),
    );
  });

  if (disposables.length > 0) ctx.settings.refresh();
  return disposables;
};
