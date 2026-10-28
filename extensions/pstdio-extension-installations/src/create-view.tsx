import "@pstdio/ui/style.css";
import {
  createWebviewClient,
  defineExtensionView,
  type WebviewClient,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { type ComponentType, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { type Translate, translator } from "./messages";

export interface ViewProps {
  client: WebviewClient<Record<string, never>>;
  projectId?: string;
  t: Translate;
}
export const createInstallationView = (Component: ComponentType<ViewProps>) =>
  defineExtensionView({
    render({ mount, host, propsStore }) {
      const client = createWebviewClient<Record<string, never>>(host);
      const Content = () => {
        const props: WebviewHostProps = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
        return <Component client={client} projectId={props.projectId} t={translator(props)} />;
      };
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <Content />
        </ChakraProvider>,
      );
      return () => root.unmount();
    },
  });
