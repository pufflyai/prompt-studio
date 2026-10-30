import { Box, Button, HStack, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import type { WebviewOverlayRequest, WebviewOverlayResult, WebviewOverlaysClient } from "@pstdio/sdk/extensions";
import { useRef, useState } from "react";
import { Tooltip } from "./tooltip";
import { WebviewOverlayProvider, WebviewOverlayTrigger } from "./webview-overlay-provider";
import { WebviewOverlaySurface } from "./webview-overlay-surface";

const HostedChrome = () => {
  const [request, setRequest] = useState<WebviewOverlayRequest>();
  const [selected, setSelected] = useState("");
  const reply = useRef<((value: WebviewOverlayResult) => void) | undefined>(undefined);
  const trigger = useRef<HTMLElement | null>(null);
  const close = (actionId?: string, restoreFocus = true) => {
    setRequest(undefined);
    reply.current?.(actionId ? { actionId } : {});
    reply.current = undefined;
    if (restoreFocus) trigger.current?.focus();
  };
  const [client] = useState<WebviewOverlaysClient>(() => ({
    show: (next) => {
      trigger.current = document.activeElement as HTMLElement;
      reply.current?.({});
      setRequest(next);
      return new Promise((resolve) => {
        reply.current = resolve;
      });
    },
    move: async (id, anchor) => {
      setRequest((current) => (current?.id === id ? { ...current, anchor } : current));
      return {};
    },
    close: async (id) => {
      setRequest((current) => {
        if (current?.id !== id) return current;
        reply.current?.({});
        reply.current = undefined;
        return undefined;
      });
      return {};
    },
  }));
  return (
    <Stack gap="md">
      <WebviewOverlayProvider client={client}>
        <Box w="14" h="40" overflow="hidden" borderWidth="1px" borderColor="border">
          <Tooltip content="Move the selected layer">
            <Button size="xs">Move</Button>
          </Tooltip>
          <WebviewOverlayTrigger
            content={{
              kind: "menu",
              label: "Layer tools",
              items: [
                { id: "hand", label: "Hand tool" },
                { id: "locked", label: "Locked tool", disabled: true },
              ],
            }}
            onAction={setSelected}
          >
            <Button size="xs">Tools</Button>
          </WebviewOverlayTrigger>
          <WebviewOverlayTrigger
            content={{
              kind: "popover",
              title: "Layer details",
              text: "Shared host content",
              actions: [{ id: "apply", label: "Apply" }],
            }}
            onAction={setSelected}
          >
            <Button size="xs">Details</Button>
          </WebviewOverlayTrigger>
        </Box>
      </WebviewOverlayProvider>
      <HStack>
        <Button>Outside</Button>
        <Text role="status">{selected}</Text>
      </HStack>
      {request ? (
        <WebviewOverlaySurface
          request={request}
          getAnchorRect={() =>
            new DOMRect(request.anchor.x, request.anchor.y, request.anchor.width, request.anchor.height)
          }
          close={close}
        />
      ) : null}
    </Stack>
  );
};

const meta = {
  title: "Components/Overlays/Webview chrome",
  component: HostedChrome,
  parameters: {
    docs: {
      description: {
        component:
          "Use WebviewOverlayProvider with client.overlays inside an isolated webview. Plain-text Tooltips and WebviewOverlayTrigger content render in the host, outside the frame. The trigger keeps its accessible description; the host owns menu focus and dismissal.",
      },
    },
  },
} satisfies CanvasMeta<typeof HostedChrome>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const NarrowChrome: Story = { id: "components-overlays-webview-chrome--narrow-chrome" };
