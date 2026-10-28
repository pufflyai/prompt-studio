import { workbenchPages } from "@pstdio/sdk/extensions";
import type { WorkbenchModuleContext } from "@pstdio/workbench";
import { getDashboardSelectedProjectId } from "@/shared/app/project-context";
import { ExtensionsPanel } from "./components/extensions-panel";

export const registerExtensionDetailPage = (ctx: WorkbenchModuleContext) => {
  ctx.resources.registerKind({ kind: "extension", label: "Extension", icon: "Puzzle" });
  ctx.views.registerView({
    id: "dashboard.extension-detail",
    title: "Extension",
    body: {
      kind: "react",
      render: (input) => (
        <ExtensionsPanel
          key={input.instance.resource?.id}
          projectId={input.instance.resource?.projectId ?? getDashboardSelectedProjectId(ctx)}
          initialInstallName={input.instance.resource?.id}
          settingsInput={input}
        />
      ),
    },
  });
  ctx.pages.registerPage({
    id: "extension",
    ref: workbenchPages.extension,
    title: "Extension",
    icon: "Puzzle",
    parentId: workbenchPages.start.id,
    modeId: "project",
    path: "extensions/view",
    resource: { kinds: [{ extensionId: "pstdio", kind: "resource-kind", id: "extension" }] },
    main: {
      kind: "view",
      cardinality: "one",
      presentation: "page",
      view: { kind: "view", id: "dashboard.extension-detail" },
    },
    slots: [],
  });
};
