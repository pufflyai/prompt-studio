import "@pstdio/ui/style.css";
import { defineExtensionView, type ExtensionViewRenderContext, type WebviewHostProps } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme, ThemePreferenceProvider } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { BookApp } from "./app";
import { makeClient } from "./client";

function View(props: { context: ExtensionViewRenderContext<WebviewHostProps> }) {
  const { context } = props;
  const hostProps = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get, context.propsStore.get);
  const [client] = useState(() => makeClient(context.host));
  return (
    <ChakraProvider value={psTheme}>
      <ThemePreferenceProvider initialPreference={hostProps.themePreference}>
        <BookApp client={client} hostProps={hostProps} />
      </ThemePreferenceProvider>
    </ChakraProvider>
  );
}
export default defineExtensionView({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<View context={context} />);
    return () => root.unmount();
  },
});
