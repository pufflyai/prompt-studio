import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { useState } from "react";
import { createWorkbench } from "../../core";
import { WorkbenchStory } from "../../examples/workbench-story";

const PageWorkbench = () => {
  const [workbench] = useState(() => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "example", id: "content" } as const;
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.views.registerView({
      id: "content",
      title: "Page content",
      body: { kind: "react", render: () => <Text>Readable page content</Text> },
    });
    workbench.pages.registerPage({
      id: "content",
      ref: page,
      path: "content",
      modeId: "project",
      main: { kind: "view", presentation: "page", view: { kind: "view", id: "content" }, cardinality: "one" },
      slots: [],
    });
    workbench.pageLocations.setProject("page-fullscreen");
    workbench.pageLocations.navigate({ kind: "page", page });
    return workbench;
  });
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Reference/Core API/Main fullscreen/Page content",
  component: PageWorkbench,
  parameters: { layout: "fullscreen" },
  tags: ["main-fullscreen-page-content"],
} satisfies CanvasMeta<typeof PageWorkbench>;
export default meta;
type Story = CanvasVariant<typeof meta>;
export const EnterAndExit: Story = {
  id: "pstdio-workbench-reference-core-api-main-fullscreen-page-content--enter-and-exit",
};
