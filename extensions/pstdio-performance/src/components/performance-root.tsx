import type { ExtensionViewRenderContext } from "@pstdio/sdk/extensions";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { Activity, useSyncExternalStore } from "react";
import { PerformanceTranslations } from "../translations";

const subscribeVisibility = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const isVisible = () => !document.hidden;

interface PerformanceRootProps {
  context: ExtensionViewRenderContext;
  children: React.ReactNode;
}

export const PerformanceRoot = (props: PerformanceRootProps) => {
  const { context, children } = props;
  const visible = useSyncExternalStore(subscribeVisibility, isVisible, () => true);
  return (
    <ChakraProvider value={psTheme}>
      <PerformanceTranslations value={{ locale: context.locale, t: context.t }}>
        <Activity mode={visible ? "visible" : "hidden"}>{children}</Activity>
      </PerformanceTranslations>
    </ChakraProvider>
  );
};
