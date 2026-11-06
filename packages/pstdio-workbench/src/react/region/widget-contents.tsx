import { Activity, type ReactNode, startTransition, useContext, useEffect, useState } from "react";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistration } from "../../core";
import { afterPaint } from "../shared/after-paint";
import { ViewActivityContext } from "../shared/view-activity-context";

interface WorkbenchWidgetContentsProps {
  input: WorkbenchPanelRenderInput;
  renderer: WorkbenchRendererRegistration;
  defer: boolean;
  webview?: boolean;
}

export const WorkbenchWidgetContents = (props: WorkbenchWidgetContentsProps) => {
  const { input, renderer, defer, webview } = props;
  const active = useContext(ViewActivityContext);
  // Static rendering has no browser paint cycle to wait for.
  const [mounted, setMounted] = useState(!defer || typeof requestAnimationFrame !== "function");
  useEffect(() => {
    if (mounted) return;
    const controller = new AbortController();
    void afterPaint(controller.signal).then(
      () => startTransition(() => setMounted(true)),
      () => undefined,
    );
    return () => controller.abort();
  }, [mounted]);
  // Keep mounted panels intact when resources, placements, or regions change.
  if (!mounted) return null;
  const content = renderer.render({ ...input, visible: input.visible ?? active }) as ReactNode;
  // Webviews keep their bridge connected and receive visibility inside their document.
  return webview ? content : <Activity mode={active ? "visible" : "hidden"}>{content}</Activity>;
};
