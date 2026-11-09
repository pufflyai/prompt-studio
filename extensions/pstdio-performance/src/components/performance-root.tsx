import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { useWebviewVisibility } from "@pstdio/sdk/extensions/react";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Activity } from "react";
import { PerformanceTranslations } from "../translations";

interface PerformanceRootProps {
  context: ExtensionViewRenderContext;
  children: React.ReactNode;
}

export const PerformanceRoot = (props: PerformanceRootProps) => {
  const { context, children } = props;
  const visible = useWebviewVisibility();
  return (
    <ChakraProvider value={psTheme}>
      <PerformanceTranslations value={{ locale: context.locale, t: context.t }}>
        <Activity mode={visible ? "visible" : "hidden"}>{children}</Activity>
      </PerformanceTranslations>
    </ChakraProvider>
  );
};
