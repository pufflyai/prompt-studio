import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
} satisfies Meta<typeof PageWorkbench>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EnterAndExit: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const content = await canvas.findByText("Readable page content");
    await expect(content).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Enter Main fullscreen" }));
    await expect(content).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Exit Main fullscreen" }));
    await expect(canvas.getByRole("button", { name: "Enter Main fullscreen" })).toHaveFocus();
  },
};
