import { Box, Center, Spinner, Text } from "@chakra-ui/react";
import { useState } from "react";

type WebviewDescriptor = {
  entry: { kind: "package-asset"; path: string; baseUrl: string };
  title?: string;
  sandbox?: "default" | "strict";
};

interface ExtensionWebviewFrameProps {
  webview?: WebviewDescriptor;
  title?: string;
}

const resolveWebviewSrc = (webview: WebviewDescriptor) => new URL(webview.entry.path, webview.entry.baseUrl).toString();

export const ExtensionWebviewFrame = (props: ExtensionWebviewFrameProps) => {
  const { webview, title } = props;
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  if (!webview) {
    return null;
  }

  return (
    <Box position="relative" width="100%" height="100%" minH="0" bg="bg">
      {state === "loading" ? (
        <Center position="absolute" inset="0" color="fg.muted">
          <Spinner size="sm" />
        </Center>
      ) : null}
      {state === "error" ? (
        <Center position="absolute" inset="0" px="md">
          <Text textStyle="paragraph/S/regular" color="fg.muted">
            Extension view failed to load.
          </Text>
        </Center>
      ) : null}
      <iframe
        title={webview.title ?? title ?? "Extension view"}
        src={resolveWebviewSrc(webview)}
        sandbox={webview.sandbox === "strict" ? "allow-scripts" : "allow-scripts allow-forms allow-popups"}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
      />
    </Box>
  );
};
