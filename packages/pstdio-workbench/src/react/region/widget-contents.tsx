import { type ReactNode, startTransition, useEffect, useState } from "react";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistration } from "../../core";
import { afterPaint } from "../shared/after-paint";

interface WorkbenchWidgetContentsProps {
  input: WorkbenchPanelRenderInput;
  renderer: WorkbenchRendererRegistration;
  defer: boolean;
}

export const WorkbenchWidgetContents = (props: WorkbenchWidgetContentsProps) => {
  const { input, renderer, defer } = props;
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
  return mounted ? (renderer.render(input) as ReactNode) : null;
};
