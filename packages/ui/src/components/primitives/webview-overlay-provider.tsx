import { Box } from "@chakra-ui/react";
import {
  observeWebviewOverlayAnchor,
  type WebviewOverlayContent,
  type WebviewOverlaysClient,
} from "@pstdio/sdk/extensions";
import {
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

const OverlayContext = createContext<{ client: WebviewOverlaysClient; onError(error: unknown): void } | undefined>(
  undefined,
);
export const WebviewOverlayProvider = (props: {
  client: WebviewOverlaysClient;
  children: ReactNode;
  onError?(error: unknown): void;
}) => {
  const { client, children, onError = console.error } = props;
  return <OverlayContext.Provider value={{ client, onError }}>{children}</OverlayContext.Provider>;
};
export const useWebviewOverlayClient = () => useContext(OverlayContext)?.client;
export const useWebviewOverlayError = () => useContext(OverlayContext)?.onError ?? console.error;

/** Menus and popovers keep their trigger in the guest and render their content in the host. */
export const WebviewOverlayTrigger = (props: {
  children: ReactElement;
  content: Exclude<WebviewOverlayContent, { kind: "tooltip" }>;
  onAction?(id: string): void;
}) => {
  const { children, content, onAction } = props;
  const client = useWebviewOverlayClient();
  const reportError = useWebviewOverlayError();
  const id = useId();
  const trigger = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const latest = useRef({ content, onAction, reportError });
  useEffect(() => {
    latest.current = { content, onAction, reportError };
  });
  const contentKey = JSON.stringify(content);
  // biome-ignore lint/correctness/useExhaustiveDependencies: content changes replace the host overlay; parent object identity must not reopen it.
  useEffect(() => {
    if (!client || !open || !trigger.current) return;
    const anchor = trigger.current;
    let active = true;
    void client
      .show({ id, content: latest.current.content, anchor: anchor.getBoundingClientRect() })
      .then((result) => {
        if (!active) return;
        setOpen(false);
        if (result.actionId) latest.current.onAction?.(result.actionId);
      })
      .catch((error) => {
        if (active) {
          setOpen(false);
          latest.current.reportError(error);
        }
      });
    const stop = observeWebviewOverlayAnchor(
      anchor,
      (rect) => {
        void client.move(id, rect).catch(latest.current.reportError);
      },
      () => {
        void client.close(id).catch(latest.current.reportError);
      },
    );
    return () => {
      active = false;
      stop();
      void client.close(id).catch(latest.current.reportError);
    };
  }, [client, open, id, contentKey]);
  return (
    <Box
      asChild
      ref={trigger}
      aria-haspopup={content.kind === "menu" ? "menu" : "dialog"}
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      {children}
    </Box>
  );
};
