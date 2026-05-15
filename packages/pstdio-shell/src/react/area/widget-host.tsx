import { Box, Center, chakra } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  BRIDGE_WEBVIEW_RENDERER_ID,
  resolveShellWidgetRendererId,
  type ShellCore,
  type ShellWidgetPlacement,
  type WebviewDescriptor,
} from "../../core";
import { ShellIcon } from "../shared/icon";
import { useShellStore } from "../shared/use-shell-store";

interface ShellWidgetHostProps {
  shell: ShellCore;
  placement: ShellWidgetPlacement;
}

const getWebviewSource = (webview: WebviewDescriptor) =>
  webview.runtimeUrl ?? webview.assetUrl ?? webview.moduleUrl ?? webview.entry?.baseUrl;

const isBridgeWebview = (webview: WebviewDescriptor) => Boolean(webview.runtimeUrl && webview.moduleUrl);

const ShellWidgetFallback = (props: { label: string }) => {
  const { label } = props;

  return (
    <Center h="full" w="full" color="fg.muted" p="md" aria-label={label}>
      <ShellIcon name="circle-alert" size={20} />
    </Center>
  );
};

const ShellRenderedWidgetFrame = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <Box flex="1" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {children}
    </Box>
  );
};

const noopRefresh = () => undefined;

const resolveWidgetRendererStoreId = (widget: ReturnType<ShellCore["layout"]["getWidget"]>) => {
  if (!widget) return undefined;
  if (widget.renderer === "webview" && widget.webview && isBridgeWebview(widget.webview)) {
    return BRIDGE_WEBVIEW_RENDERER_ID;
  }

  return resolveShellWidgetRendererId(widget);
};

export const ShellWidgetHost = (props: ShellWidgetHostProps) => {
  const { shell, placement } = props;
  const widget = shell.layout.getWidget(placement.contributionId);
  const refresh = noopRefresh;
  const rendererId = resolveWidgetRendererStoreId(widget);
  const renderer = useShellStore(shell.renderers.store, (state) => (rendererId ? state.renderers[rendererId] : undefined));

  if (!widget) {
    return <ShellWidgetFallback label="Widget contribution is no longer registered." />;
  }

  if (widget.renderer === "webview" && widget.webview) {
    if (isBridgeWebview(widget.webview)) {
      return (
        <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
          {renderer ? (
            (renderer.render({ shell, widget, placement, refresh }) as ReactNode)
          ) : (
            <ShellWidgetFallback label="Bridge webview renderer is not registered." />
          )}
        </Box>
      );
    }

    const source = getWebviewSource(widget.webview);

    return (
      <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
        {source ? (
          <chakra.iframe
            src={source}
            title={widget.webview.title ?? widget.title}
            // Webview content is untrusted — never grant `allow-same-origin`, which would
            // let a guest reach into the host document.
            sandbox={widget.webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups"}
            border="0"
            flex="1"
            h="full"
            minW="0"
            w="full"
          />
        ) : (
          <ShellWidgetFallback label="Webview source is not configured." />
        )}
      </Box>
    );
  }

  return (
    <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {renderer ? (
        <ShellRenderedWidgetFrame>
          {renderer.render({ shell, widget, placement, refresh }) as ReactNode}
        </ShellRenderedWidgetFrame>
      ) : (
        <ShellWidgetFallback label={`No renderer registered for ${rendererId}.`} />
      )}
    </Box>
  );
};
