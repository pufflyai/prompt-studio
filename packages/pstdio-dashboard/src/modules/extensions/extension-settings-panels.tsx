import type { Disposable, WorkbenchModuleContributionContext } from "pstdio-workbench/core";
import { ExtensionWebviewFrame } from "@/shared/extensions/components/extension-webview-frame";
import { resolveLocalizableString } from "@/shared/extensions/extension-localization";
import type { DashboardExtensionMetadata } from "@/shared/extensions/workbench-extension-contributions";

// Surfaces extension-contributed settings panels (e.g. ticket / workspace statuses)
// in the dashboard settings tree, rendering each as its bridged webview. Project-scoped
// panels go under the Project section; global ones under Workbench.
export const registerExtensionSettingsPanels = (
  ctx: WorkbenchModuleContributionContext,
  input: { metadata: DashboardExtensionMetadata; projectId: string },
) => {
  const { metadata, projectId } = input;
  const disposables: Disposable[] = [];

  metadata.settingsPanels?.forEach((panel, index) => {
    const scope = panel.scope === "global" ? "global" : "project";
    const title = resolveLocalizableString(panel.title, panel.extensionId);
    disposables.push(
      ctx.settings.registerPanel({
        kind: "custom",
        id: panel.id,
        title,
        section: scope === "global" ? "workbench" : "project",
        scope,
        order: 60 + index,
        icon: "Sliders",
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
