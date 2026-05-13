import { Box, Center, chakra, Text } from "@chakra-ui/react";
import type { ReactNode } from "react";
import {
  resolveShellWidgetRendererId,
  type ShellCore,
  type ShellWidgetPlacement,
  type WebviewDescriptor,
} from "../core";

interface ShellWidgetHostProps {
  shell: ShellCore;
  placement: ShellWidgetPlacement;
  refresh?: () => void;
}

const getWebviewSource = (webview: WebviewDescriptor) =>
  webview.runtimeUrl ?? webview.assetUrl ?? webview.moduleUrl ?? webview.entry?.baseUrl;

const ShellWidgetFallback = (props: { children: ReactNode }) => {
  const { children } = props;

  return (
    <Center h="full" w="full" color="fg.muted" p="md" textAlign="center">
      <Text textStyle="paragraph/S/regular">{children}</Text>
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

export const ShellWidgetHost = (props: ShellWidgetHostProps) => {
  const { shell, placement, refresh = () => undefined } = props;
  const widget = shell.layout.getWidget(placement.contributionId);

  if (!widget) {
    return <ShellWidgetFallback>Widget contribution is no longer registered.</ShellWidgetFallback>;
  }

  if (widget.renderer === "webview" && widget.webview) {
    const source = getWebviewSource(widget.webview);

    return (
      <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
        {source ? (
          <chakra.iframe
            src={source}
            title={widget.webview.title ?? widget.title}
            sandbox={widget.webview.sandbox === "strict" ? "" : "allow-scripts allow-same-origin allow-forms"}
            border="0"
            flex="1"
            h="full"
            minW="0"
            w="full"
          />
        ) : (
          <ShellWidgetFallback>Webview source is not configured.</ShellWidgetFallback>
        )}
      </Box>
    );
  }

  const rendererId = resolveShellWidgetRendererId(widget);
  const renderer = shell.renderers.getRenderer(rendererId);

  return (
    <Box display="flex" minW="0" minH="0" w="full" h="full" overflow="hidden">
      {renderer ? (
        <ShellRenderedWidgetFrame>
          {renderer.render({ shell, widget, placement, refresh }) as ReactNode}
        </ShellRenderedWidgetFrame>
      ) : (
        <ShellWidgetFallback>No renderer registered for {rendererId}.</ShellWidgetFallback>
      )}
    </Box>
  );
};
