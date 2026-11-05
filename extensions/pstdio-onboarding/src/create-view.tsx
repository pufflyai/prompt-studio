import { createWebviewClient, defineExtensionView, type WebviewClient } from "@pstdio/sdk/extensions";
import { type ComponentType, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import type { commands } from "./commands";
import { SetupProvider } from "./provider";
export type SetupClient = WebviewClient<typeof commands>;
export const createSetupView = (Component: ComponentType<{ client: SetupClient }>) =>
  defineExtensionView({
    render({ host, mount, propsStore }) {
      const client = createWebviewClient<typeof commands>(host);
      const Content = () => {
        const props = useSyncExternalStore(propsStore.subscribe, propsStore.get, propsStore.get);
        return (
          <SetupProvider key={props.locale} language={props.locale}>
            <Component client={client} />
          </SetupProvider>
        );
      };
      const root = createRoot(mount);
      root.render(<Content />);
      return () => root.unmount();
    },
  });
