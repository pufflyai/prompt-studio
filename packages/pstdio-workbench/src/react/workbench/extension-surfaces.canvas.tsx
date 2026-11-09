import { Box, Input, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

export default {
  title: "Product/Workbench/Extension surfaces",
  fullscreen: true,
  description: "Performance uses native Main tabs. Shape Art uses a native attached settings menu.",
};

const createSurface = (kind: "performance" | "shape-art") => {
  const page = { extensionId: "preview", kind: "page" as const, id: kind };
  const workbench = createWorkbench({ startPage: page });
  workbench.modes.registerMode({ id: kind, activate: () => undefined });
  const names = kind === "performance" ? ["Trends", "Compare", "Runs"] : ["Shape Art", "Art settings"];
  for (const title of names) {
    workbench.views.registerView({
      id: title,
      title,
      body: {
        kind: "react",
        render: () => (
          <Stack p="md">
            <Text>{title}</Text>
            {title === "Art settings" ? <Input aria-label="Seed" defaultValue="prompt-studio" /> : null}
          </Stack>
        ),
      },
    });
  }
  if (kind === "shape-art") {
    workbench.viewMenus.registerViewMenu({
      id: "art-settings",
      ownerViewId: "Shape Art",
      viewId: "Art settings",
      side: "right",
    });
  }
  workbench.pages.registerPage({
    id: kind,
    ref: page,
    title: kind === "performance" ? "Performance" : "Shape Art",
    path: kind,
    modeId: kind,
    main:
      kind === "performance"
        ? { kind: "panels", landing: "trends" }
        : { kind: "view", view: { kind: "view", id: "Shape Art" }, cardinality: "one", presentation: "page" },
    slots:
      kind === "performance"
        ? names.map((title, order) => ({
            id: title.toLowerCase(),
            region: "main" as const,
            order,
            mountStrategy: "keep-mounted" as const,
            item: { kind: "view" as const, view: { kind: "view" as const, id: title }, presence: "open" as const },
          }))
        : [],
  });
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
