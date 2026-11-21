import { Box, Button, HStack, Input, Stack, Text } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { Header } from "@pstdio/ui";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { Workbench, WorkbenchPanelToggles, WorkbenchThemeProvider } from "..";

const tool = { kind: "page", extensionId: "preview", id: "tool" } as const;
const collection = { kind: "page", extensionId: "preview", id: "collection" } as const;
const Controls = () => {
  const [search, setSearch] = useState("");
  return (
    <HStack w="full" justify="end" gap="sm">
      <Button size="xs" variant="primary">
        Upgrade all
      </Button>
      <Input
        size="xs"
        w="48"
        aria-label="Search extensions"
        placeholder="Search extensions…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
    </HStack>
  );
};
const createHeaderWorkbench = () => {
  const workbench = createWorkbench({ defaultPage: tool });
  workbench.modes.registerMode({ id: "project", label: "Project", activate: () => undefined });
  workbench.views.registerView({
    id: "toolbar",
    title: "Controls",
    body: { kind: "react", render: () => <Controls /> },
  });
  workbench.views.registerView({
    id: "extensions",
    title: "Extensions",
    header: { viewId: "toolbar" },
    body: {
      kind: "react",
      render: () => <Text p="md">Extensions content. Search and Filters follow this live view.</Text>,
    },
  });
  workbench.views.registerView({
    id: "filters",
    title: "Filters",
    icon: "ListFilter",
    body: { kind: "react", render: () => <Text p="md">Extension filters</Text> },
  });
  workbench.views.registerView({
    id: "notes",
    title: "Notes",
    body: { kind: "react", render: () => <Text p="md">Notes has no header controls or view menus.</Text> },
  });
  workbench.viewMenus.registerViewMenu({
    id: "filters",
    ownerViewId: "extensions",
    viewId: "filters",
    side: "right",
    hiddenByDefault: true,
  });
  workbench.pages.registerPage({
    id: "tool",
    ref: tool,
    title: "Extensions",
    path: "tool",
    modeId: "project",
    main: { kind: "view", presentation: "page", cardinality: "one", view: { kind: "view", id: "extensions" } },
    slots: [],
  });
  workbench.pages.registerPage({
    id: "collection",
    ref: collection,
    title: "Tools",
    path: "tools",
    modeId: "project",
    main: { kind: "panels", empty: { kind: "view", id: "notes" } },
    slots: [
      { id: "notes", region: "main", item: { kind: "view", presence: "fixed", view: { kind: "view", id: "notes" } } },
    ],
  });
  workbench.pageLocations.setProject("header-preview");
  workbench.pageLocations.navigate({ kind: "page", page: tool });
  return workbench;
};
export default {
  title: "Product/Workbench/Header/Page and tab controls",
  description:
    "App-level project and panel controls sit above the workbench. View actions are centered in page chrome or the shared short tab subheader.",
  fullscreen: true,
} satisfies CanvasMeta;

export const PageAndTabSubheaders = () => {
  const [workbench] = useState(createHeaderWorkbench);
  const move = (region: "side" | "secondary") => {
    const content = workbench.pages.getContent();
    if (content) workbench.movePanel(content.widgetId, region);
  };
  return (
    <Stack h="full" gap="sm">
      <HStack gap="sm" flexWrap="wrap">
        <Button size="xs" onClick={() => workbench.navigation.openTarget({ kind: "page", page: tool })}>
          Show Extensions page
        </Button>
        <Button size="xs" onClick={() => move("side")}>
          Move page to Side
        </Button>
        <Button size="xs" onClick={() => move("secondary")}>
          Move page to Bottom
        </Button>
        <Button size="xs" onClick={() => workbench.navigation.openTarget({ kind: "page", page: collection })}>
          Show tabbed Main
        </Button>
      </HStack>
      <Box flex="1" minH="0" overflow="hidden">
        <WorkbenchThemeProvider>
          <Workbench
            workbench={workbench}
            panelControlsPlacement="host"
            titleBar={
              <Header>
                <Text flex="1">Header preview</Text>
                <WorkbenchPanelToggles workbench={workbench} />
              </Header>
            }
          />
        </WorkbenchThemeProvider>
      </Box>
    </Stack>
  );
};
