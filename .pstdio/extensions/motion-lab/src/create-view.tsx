import "@pstdio/ui/style.css";
import { defineExtensionView } from "@pstdio/sdk/extensions";
import { ChakraProvider, installPrismGlobal, psTheme } from "@pstdio/ui";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import type { ReviewProps } from "./review-context";

export const createView = (load: () => Promise<ComponentType>) =>
  defineExtensionView<ReviewProps>({
    async render({ mount, host, propsStore }) {
      await installPrismGlobal();
      const { ReviewRoot } = await import("./review-root");
      const Component = await load();
      const root = createRoot(mount);
      root.render(
        <ChakraProvider value={psTheme}>
          <ReviewRoot Component={Component} host={host} propsStore={propsStore} />
        </ChakraProvider>,
      );
      return () => root.unmount();
    },
  });
