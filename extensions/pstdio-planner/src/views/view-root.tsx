import "@pstdio/ui/style.css";

import { ChakraProvider, psTheme } from "@pstdio/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Each extension panel mounts as its own React root, so it gets its own query
// client. Wraps the common providers shared by every tickets webview.
export const renderTicketRoot = (mount: HTMLElement, children: ReactNode) => {
  const queryClient = new QueryClient();
  const root = createRoot(mount);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider value={psTheme}>{children}</ChakraProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
  return () => root.unmount();
};
