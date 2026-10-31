import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { PerformanceTranslations } from "../translations";

interface PerformanceRootProps {
  context: ExtensionViewRenderContext;
  children: React.ReactNode;
}

export const PerformanceRoot = (props: PerformanceRootProps) => {
  const { context, children } = props;
  return (
    <ChakraProvider value={psTheme}>
      <PerformanceTranslations value={{ locale: context.locale, t: context.t }}>{children}</PerformanceTranslations>
    </ChakraProvider>
  );
};
