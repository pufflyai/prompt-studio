import { webviewOverlayParamsSchema } from "pstdio-api-contracts";
import type {
  WebviewOverlayRect,
  WebviewOverlayRequest,
  WebviewOverlayResult,
} from "pstdio-api-contracts/extension-kernel";

export interface WebviewOverlayPresentation {
  request: WebviewOverlayRequest;
  getAnchorRect(): DOMRect;
  close(actionId?: string, restoreFocus?: boolean): void;
}

/** A frame owns one overlay and its outstanding reply. Nothing survives that view's disposal. */
export const createWebviewOverlayController = (publish: (request?: WebviewOverlayRequest) => void) => {
  let current: WebviewOverlayRequest | undefined;
  let settle: ((result: WebviewOverlayResult) => void) | undefined;
  const close = (actionId?: string) => {
    const content = current?.content;
    let actions: { id: string; disabled?: boolean }[] = [];
    if (content?.kind === "menu") actions = content.items;
    if (content?.kind === "popover") actions = content.actions ?? [];
    if (actionId && !actions?.some((action) => action.id === actionId && !action.disabled)) return;
    const resolve = settle;
    current = undefined;
    settle = undefined;
    publish();
    resolve?.(actionId ? { actionId } : {});
  };
  return {
    close,
    dispose: () => close(),
    call(input: unknown) {
      const result = webviewOverlayParamsSchema.safeParse(input);
      if (!result.success)
        throw Object.assign(new Error("Invalid parameters for overlays."), {
          code: "invalid_params",
          data: {
            capability: "overlays",
            issues: result.error.issues.map((issue) => ({ path: issue.path.map(String), message: issue.message })),
          },
        });
      const next = result.data;
      if (next.op === "show") {
        close();
        current = next;
        return new Promise<WebviewOverlayResult>((resolve) => {
          settle = resolve;
          publish(current);
        });
      }
      if (next.id !== current?.id) return {};
      if (next.op === "close") close();
      else {
        current = { ...current, anchor: next.anchor };
        publish(current);
      }
      return {};
    },
  };
};

/** Convert a guest viewport anchor through the source iframe's actual rendered scale. */
export const webviewOverlayAnchor = (
  source: { bounds: WebviewOverlayRect; width: number; height: number },
  anchor: WebviewOverlayRect,
) => {
  const scaleX = source.bounds.width / source.width;
  const scaleY = source.bounds.height / source.height;
  return {
    x: source.bounds.x + anchor.x * scaleX,
    y: source.bounds.y + anchor.y * scaleY,
    width: anchor.width * scaleX,
    height: anchor.height * scaleY,
  };
};
