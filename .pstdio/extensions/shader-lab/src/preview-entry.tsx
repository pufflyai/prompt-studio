import "@pstdio/ui/style.css";
import { defineExtensionView, type PageLocation, type ResourceRef } from "@pstdio/sdk/extensions";
import { ChakraProvider, installPrismGlobal, psTheme } from "@pstdio/ui";
import { createRoot } from "react-dom/client";

interface PreviewProps {
  resource?: ResourceRef;
  pageLocation?: PageLocation;
}

// The Shader Lab home page has no version selected; the preview then opens the first one in the lab.
const versionIdOf = (props: PreviewProps) => props.resource?.id ?? props.pageLocation?.resource?.id;

export default defineExtensionView<PreviewProps>({
  async render({ mount, host, propsStore }) {
    // The chat composer's editor expects the Prism global before its module loads.
    await installPrismGlobal();
    const { ShaderPreview } = await import("./preview");
    const root = createRoot(mount);
    const draw = () =>
      root.render(
        <ChakraProvider value={psTheme}>
          <ShaderPreview host={host} versionId={versionIdOf(propsStore.get())} />
        </ChakraProvider>,
      );
    draw();
    const unsubscribe = propsStore.subscribe(draw);
    return () => {
      unsubscribe();
      root.unmount();
    };
  },
});
