import { Box } from "@chakra-ui/react";
import type { WorkbenchWidgetRenderInput } from "../../../../../react";
import { WebviewPlaceholder } from "../../../shared/components/webview-placeholder";

export const ExtensionRouteWidget = (props: { input: WorkbenchWidgetRenderInput }) => {
  const { input } = props;
  const routeId = input.placement.resource?.id ?? "repo-health";
  const title = input.placement.resource?.label ?? "Repo health";
  const entry = routeId === "changelog" ? "changelog.tsx" : routeId === "lab" ? "lab.tsx" : "health-page.tsx";

  return (
    <Box h="full" minH="0" p="md">
      <WebviewPlaceholder
        slotId="routes[].webview"
        title={`/projects/acme/extensions/${routeId}`}
        contributor={title === "Lab" ? "extension-lab" : "repo-health"}
        entry={entry}
        icon={input.placement.resource?.icon ?? "PanelLeft"}
        height="100%"
      />
    </Box>
  );
};
