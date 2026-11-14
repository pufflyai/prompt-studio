import { Box, Button, Input, Stack, Text } from "@chakra-ui/react";
import { createWorkbench } from "@pstdio/workbench";
import { Workbench, WorkbenchThemeProvider } from "@pstdio/workbench/react";
import { useEffect, useState } from "react";

// Use public package exports so this exercises React Compiler's production output.

const page = (id: string) => ({ kind: "page" as const, extensionId: "preview", id });

export const PageReturn = () => {
  const [workbench] = useState(() => {
    const w = createWorkbench();
    w.modes.registerMode({ id: "project", chrome: { sidenav: "navigation" }, activate() {} });
    w.views.registerView({
      id: "navigation",
      title: "Navigation",
      body: {
        kind: "react",
        render: () => (
          <Stack p="md">
            <Button onClick={() => w.navigation.openTarget({ kind: "page", page: page("home") })}>Home</Button>
            <Button
              onClick={() =>
                w.navigation.openTarget({
                  kind: "page",
                  page: page("canvas"),
                  resource: { type: "canvas", id: "design", label: "Design" },
                  open: "preview",
                })
              }
            >
              Canvas
            </Button>
          </Stack>
        ),
      },
    });
    w.views.registerView({
      id: "home",
      title: "Home",
      body: {
        kind: "react",
        render: () => (
          <Stack p="md">
            <Text>Home content</Text>
            <Input aria-label="Home draft" />
          </Stack>
        ),
      },
    });
    w.views.registerView({
      id: "canvas",
      title: "Canvas",
      body: { kind: "react", render: () => <Text p="md">Canvas content</Text> },
    });
    const canvasTabs = { kind: "placement" as const, extensionId: "preview", id: "canvas-tabs" };
    w.modePlacements.registerPlacement({
      id: "canvas-tabs",
      ref: canvasTabs,
      modeId: "project",
      region: "main",
      mountStrategy: "keep-mounted",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "canvas" }],
          view: { kind: "view", id: "canvas" },
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
      main: { kind: "panels", landing: canvasTabs },
      slots: [],
    });
    w.pageLocations.setProject("page-return");
    w.navigation.openTarget({ kind: "page", page: page("home") });
    return w;
  });
  useEffect(
    () => () => {
      void workbench.dispose();
    },
    [workbench],
  );
  return (
    <WorkbenchThemeProvider>
      <Box h="100dvh">
        <Workbench workbench={workbench} />
      </Box>
    </WorkbenchThemeProvider>
  );
};

export default { title: "Product/Workbench/Panels/Page return", fullscreen: true };
