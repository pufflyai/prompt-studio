import { Box } from "@chakra-ui/react";
import type { WorkbenchPanelRenderInput } from "../../../../../react";
import { WebviewPlaceholder } from "../../../shared/components/webview-placeholder";

export const ExtensionRouteWidget = (props: { input: WorkbenchPanelRenderInput }) => {
  const { input } = props;
  const routeId = input.instance.resource?.id ?? "repo-health";
  const title = input.instance.resource?.label ?? "Repo health";
  const entry = routeId === "changelog" ? "changelog.tsx" : routeId === "lab" ? "lab.tsx" : "health-page.tsx";

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="routes[].webview"
        title={`/projects/acme/extensions/${routeId}`}
        contributor={title === "Lab" ? "extension-lab" : "repo-health"}
        entry={entry}
        icon={input.instance.resource?.icon ?? "PanelLeft"}
        height="100%"
      />
    </Box>
  );
};
