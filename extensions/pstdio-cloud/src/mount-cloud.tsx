import "@pstdio/ui/style.css";
import { createWebviewClient, defineExtensionView, type WebviewHostProps } from "@pstdio/sdk/extensions";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Activity, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "./button";
import { CloudContext } from "./cloud-context";
import { CloudDetails } from "./cloud-details";
import { CloudLabel } from "./cloud-label";
import { CloudSettings } from "./cloud-settings";
import { useCloud } from "./use-cloud";

const Status = (props: { projectId?: string }) => {
  const { projectId } = props;
  const { data, error } = useCloud(projectId, false);
  return (
    <Button variant="ghost-static" size="xs" tabIndex={-1} h="100dvh" data-testid="cloud-status-item">
      <CloudLabel data={data} error={error} />
    </Button>
  );
};

export const cloudView = (screen: "status" | "details" | "settings") =>
  defineExtensionView<WebviewHostProps>({
    render(context) {
      const client = createWebviewClient<Record<never, never>>(context.host);
      const App = () => {
        const { projectId } = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
        const visible = useWebviewVisibility();
        let content = <Status key={projectId} projectId={projectId} />;
        if (screen === "details") content = <CloudDetails key={projectId} projectId={projectId} />;
        if (screen === "settings") content = <CloudSettings key={projectId} projectId={projectId} />;
        return (
          <ChakraProvider value={psTheme}>
            <CloudContext value={{ client, t: context.t }}>
              <Activity mode={visible ? "visible" : "hidden"}>{content}</Activity>
            </CloudContext>
          </ChakraProvider>
        );
      };
      const root = createRoot(context.mount);
      root.render(<App />);
      return () => {
        root.unmount();
        client.queries.dispose();
      };
    },
  });
