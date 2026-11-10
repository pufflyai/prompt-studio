import { Box, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

export default {
  title: "Product/Workbench/Extension surfaces",
  fullscreen: true,
  description:
    "Performance expands in project navigation. Runs and Shape Art own native attached menus with their declared icons.",
};

const createSurface = (kind: "performance" | "shape-art") => {
  const page = { extensionId: "preview", kind: "page" as const, id: kind };
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: kind, activate: () => undefined });
  const names = kind === "performance" ? ["Trends", "Compare", "Runs", "New run"] : ["Shape Art", "Art settings"];
  for (const title of names) {
    workbench.views.registerView({
      id: title,
      title,
      icon: title === "Art settings" ? "Settings" : "Play",
      body: {
        kind: "react",
        render: () => (
          <Stack p="md">
            <Text>{title}</Text>
            {title === "Art settings" ? <Input aria-label="Seed" defaultValue="prompt-studio" /> : null}
            {title === "New run" ? <Input aria-label="Commit" defaultValue="main" /> : null}
          </Stack>
        ),
      },
    });
  }
  workbench.viewMenus.registerViewMenu({
    id: "settings",
    ownerViewId: kind === "performance" ? "Runs" : "Shape Art",
    viewId: kind === "performance" ? "New run" : "Art settings",
    side: "right",
  });
  const destinations = kind === "performance" ? ["Trends", "Compare", "Runs"] : ["Shape Art"];
  const pageFor = (title: string) => ({
    ...page,
    id: title === "Trends" || title === "Shape Art" ? kind : title.toLowerCase(),
  });
  for (const title of destinations) {
    workbench.pages.registerPage({
      id: pageFor(title).id,
      ref: pageFor(title),
      title: title === "Trends" ? "Performance" : title,
      path: pageFor(title).id,
      modeId: kind,
      main: { kind: "view", view: { kind: "view", id: title }, cardinality: "one", presentation: "page" },
      slots: [],
    });
  }
  if (kind === "performance") {
    workbench.views.registerView({
      id: "navigation",
      title: "Project",
      body: {
        kind: "tree",
        getBody: () => [
          {
            id: "tools",
            nodes: [
              {
                id: "performance",
                label: "Performance",
                icon: "Gauge",
                collapsible: true,
                children: destinations.map((title) => ({
                  id: title,
                  label: title,
                  target: { kind: "page", page: pageFor(title) },
                })),
              },
            ],
          },
        ],
        getChildren: () => [],
      },
    });
    workbench.shellPlacements.registerPlacement({
      id: "navigation",
      region: "sidenav",
      item: { kind: "view", presence: "fixed", view: { kind: "view", id: "navigation" } },
    });
  }
  workbench.pageLocations.switchProject("extension-surfaces");
  return workbench;
};

const Surface = (props: { kind: "performance" | "shape-art" }) => {
  const [workbench] = useState(() => createSurface(props.kind));
  return (
    <Box h="100dvh">
      <WorkbenchStory workbench={workbench} />
    </Box>
  );
};

export const Performance = () => <Surface kind="performance" />;
export const ShapeArt = () => <Surface kind="shape-art" />;
