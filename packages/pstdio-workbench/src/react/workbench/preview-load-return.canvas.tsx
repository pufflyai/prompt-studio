import { Box, Button, Stack, Text } from "@chakra-ui/react";
import runtimeScript from "pstdio-extensions/bridge/webview-runtime.bundle.js?raw";
import { renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import { useEffect, useState } from "react";
import { createWorkbench } from "../../core";
import { getBridgeWebviewHostEventPublisher, renderBridgeWebviewFrame } from "../../extensions";
import { Workbench, WorkbenchThemeProvider } from "../index";

const runtimeUrl = URL.createObjectURL(
  new Blob([renderInlineExtensionRuntimeHtml(runtimeScript)], { type: "text/html" }),
);
const moduleSource = `export default { mount(root, host) {
  root.innerHTML = '<p>Loading preview</p>';
  host.call('commands.execute', { commandId: 'load', params: {} }).then(
    () => root.innerHTML = '<input aria-label="Preview draft"><p>Preview ready</p>',
    error => root.textContent = error.message
  );
  return () => root.replaceChildren();
} };`;
const moduleUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(moduleSource)}`;
const page = (id: string) => ({ kind: "page" as const, extensionId: "preview", id });

export const LoadingPreviewReturn = () => {
  const [pending, setPending] = useState(0);
  const [state] = useState(() => {
    const requests = new Set<() => void>();
    const w = createWorkbench();
    w.modes.registerMode({ id: "project", activate() {} });
    w.views.registerView({
      id: "home",
      title: "Home",
      body: { kind: "react", render: () => <Text>Home content</Text> },
    });
    w.views.registerView({
      id: "preview",
      title: "Loading preview",
      body: {
        kind: "webview",
        render: (input) =>
          renderBridgeWebviewFrame({
            visible: input.visible,
            title: "Loading preview",
            webview: { runtimeUrl, moduleUrl, capabilities: ["commands.execute"] },
            context: {
              workbench: w,
              webviewId: "preview",
              placement: input.instance,
              hostEvents: getBridgeWebviewHostEventPublisher(w, input.instance),
            },
            createProps: () => ({}),
            createHostAdapters: ({ hostEvents }) => ({
              hostEvents,
              executeCommand: async (_input, signal) => {
                await new Promise<void>((resolve, reject) => {
                  const finish = () => {
                    signal?.removeEventListener("abort", abort);
                    requests.delete(finish);
                    setPending(requests.size);
                    resolve();
                  };
                  const abort = () => {
                    requests.delete(finish);
                    setPending(requests.size);
                    reject(signal?.reason);
                  };
                  requests.add(finish);
                  setPending(requests.size);
                  signal?.addEventListener("abort", abort, { once: true });
                  if (signal?.aborted) abort();
                });
                return { outcome: { ok: true, status: "success", value: "ready" } };
              },
            }),
          }),
      },
    });
    const tabs = { kind: "placement" as const, extensionId: "preview", id: "tabs" };
    w.modePlacements.registerPlacement({
      id: "tabs",
      ref: tabs,
      modeId: "project",
      region: "main",
      mountStrategy: "keep-mounted",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "canvas" }],
          view: { kind: "view", id: "preview" },
          cardinality: "many",
        },
      },
    });
    w.pages.registerPage({
      id: "home",
      ref: page("home"),
      path: "home",
      modeId: "project",
      main: { kind: "view", view: { kind: "view", id: "home" }, cardinality: "one", presentation: "page" },
      slots: [],
    });
    w.pages.registerPage({
      id: "canvas",
      ref: page("canvas"),
      path: "canvas",
      modeId: "project",
      resource: { kinds: [{ kind: "resource-kind", id: "canvas" }] },
      main: { kind: "panels", landing: tabs },
      slots: [],
    });
    w.pageLocations.setProject("preview-load-return");
    w.navigation.openTarget({ kind: "page", page: page("home") });
    return { w, requests };
  });
  useEffect(
    () => () => {
      void state.w.dispose();
    },
    [state],
  );
  return (
    <Stack h="100dvh" gap="sm" overflow="hidden">
      <Stack direction="row">
        <Button onClick={() => state.w.navigation.openTarget({ kind: "page", page: page("home") })}>Home</Button>
        <Button
          onClick={() =>
            state.w.navigation.openTarget({
              kind: "page",
              page: page("canvas"),
              resource: { type: "canvas", id: "loading", label: "Loading canvas" },
              open: "preview",
            })
          }
        >
          Canvas
        </Button>
        <Button
          onClick={() => {
            const placement = state.w.layout.getActivePanel("main");
            if (placement?.placementIdentity) state.w.pinPlacement(placement.placementIdentity);
          }}
        >
          Pin canvas
        </Button>
        <Button
          onClick={() => {
            for (const finish of state.requests) finish();
          }}
        >
          Finish loading
        </Button>
        <Text aria-label="Pending loads">{pending}</Text>
      </Stack>
      <Box flex="1" minH="0">
        <WorkbenchThemeProvider>
          <Workbench workbench={state.w} />
        </WorkbenchThemeProvider>
      </Box>
    </Stack>
  );
};
export default { title: "Product/Workbench/Preview load return", fullscreen: true };
