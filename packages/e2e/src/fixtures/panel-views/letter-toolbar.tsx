import "@pstdio/ui/style.css";
import { Box } from "@chakra-ui/react";
import {
  createWebviewClient,
  defineExtensionView,
  type ExtensionViewRenderContext,
  type WebviewHostProps,
} from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { LetterToolbarControls } from "./letter-toolbar-controls";
import type { headerContext } from "./panel-views";

const LetterToolbar = ({ context }: { context: ExtensionViewRenderContext<WebviewHostProps> }) => {
  const props = useSyncExternalStore(context.propsStore.subscribe, context.propsStore.get);
  const [client] = useState(() => createWebviewClient<{ "header-context": typeof headerContext }>(context.host));
  const [search, setSearch] = useState("");
  const [result, setResult] = useState("");
  return (
    <ChakraProvider value={psTheme}>
      <Box h="100dvh" minH="0" minW="0" overflow="hidden">
        <LetterToolbarControls
          search={search}
          onSearchChange={setSearch}
          resource={props.resource?.id ?? "landing"}
          result={result}
          onReadContext={() => void client.commands["header-context"]().then((id) => setResult(String(id)))}
        />
      </Box>
    </ChakraProvider>
  );
};
export default defineExtensionView<WebviewHostProps>({
  render(context) {
    const root = createRoot(context.mount);
    root.render(<LetterToolbar context={context} />);
    return () => root.unmount();
  },
});
