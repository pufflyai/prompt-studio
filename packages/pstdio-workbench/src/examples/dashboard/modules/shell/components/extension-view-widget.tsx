import { Box } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../../../../react";
import { WebviewPlaceholder } from "../../../shared/components/webview-placeholder";

export const ExtensionViewWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const viewId = input.instance.viewId ?? "repo-health";
  const view = input.workbench.views.getView(viewId);
  const title = view?.title ?? "Repo health";
  const entry = viewId === "changelog" ? "changelog.tsx" : viewId === "lab" ? "lab.tsx" : "health-page.tsx";

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="routes[].webview"
        title={`/projects/acme/extensions/${viewId}`}
        contributor={title === "Lab" ? "extension-lab" : "repo-health"}
        entry={entry}
        icon={view?.icon ?? "PanelLeft"}
        height="100%"
      />
    </Box>
  );
};
