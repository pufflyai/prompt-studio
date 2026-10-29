import { useTooltipContext, VisuallyHidden } from "@chakra-ui/react";
import {
  observeWebviewOverlayAnchor,
  type WebviewOverlayRequest,
  type WebviewOverlaysClient,
} from "@pstdio/sdk/extensions";
import { useEffect, useId, useRef } from "react";
import { useWebviewOverlayError } from "./webview-overlay-provider";

export const WebviewTooltip = (props: {
  client: WebviewOverlaysClient;
  text: string;
  triggerId: string;
  placement?: WebviewOverlayRequest["placement"];
}) => {
  const { client, text, triggerId, placement } = props;
  const api = useTooltipContext();
  const id = useId();
  const onError = useWebviewOverlayError();
  const report = useRef(onError);
  report.current = onError;
  useEffect(() => {
    if (!api.open) return;
    const trigger = document.getElementById(triggerId);
    if (!trigger) return;
    void client
      .show({
        id,
        content: { kind: "tooltip", text },
        anchor: trigger.getBoundingClientRect(),
        placement,
      })
      .catch((error) => report.current(error));
    const stop = observeWebviewOverlayAnchor(
      trigger,
      (rect) => {
        void client.move(id, rect).catch((error) => report.current(error));
      },
      () => {
        void client.close(id).catch((error) => report.current(error));
      },
    );
    return () => {
      stop();
      void client.close(id).catch((error) => report.current(error));
    };
  }, [api.open, client, text, triggerId, id, placement]);
  // The accessible description stays in the trigger's own document.
  return api.open ? (
    <VisuallyHidden id={api.getContentProps().id} role="tooltip">
      {text}
    </VisuallyHidden>
  ) : null;
};
