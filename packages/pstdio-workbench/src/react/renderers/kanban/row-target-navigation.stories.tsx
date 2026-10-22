import { Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";

const RowTargetNavigation = () => {
  const [workbench] = useState(() => {
    const w = createWorkbench();
    const ref = (id: string) => ({ kind: "page" as const, id, extensionId: "storybook" });
    w.views.registerView({
      id: "board",
      title: "Board",
      body: {
        kind: "kanban",
        attributes: [],
        defaultSettings: { columnGrouping: "none", rowGrouping: "none" },
        executeQuery: async () => [
          {
            id: "a",
            title: "Ticket A",
            attributes: {},
            target: {
              kind: "page",
              page: ref("ticket"),
              resource: { type: "ticket", id: "a", label: "Ticket A" },
            },
          },
        ],
        onRowActivate: () => {
          throw new Error("Navigation must use the declared target");
        },
      },
    });
    w.views.registerView({
      id: "editor",
      title: "Editor",
      body: { kind: "react", render: () => <Text>Ticket opened</Text> },
    });
    w.modes.registerMode({ id: "project", activate() {} });
    for (const id of ["tickets", "ticket"])
      w.pages.registerPage({
        id,
        ref: ref(id),
        title: id,
        path: id,
        modeId: "project",
        slots: [],
        ...(id === "ticket"
          ? { parentId: "tickets", resource: { kinds: [{ kind: "resource-kind" as const, id: "ticket" }] } }
          : {}),
        main: { kind: "view", view: { kind: "view", id: id === "tickets" ? "board" : "editor" }, cardinality: "one" },
      });
    w.pageLocations.setProject("project");
    w.pageLocations.navigate({ kind: "page", page: ref("tickets") });
    return w;
  });
  return <WorkbenchStory workbench={workbench} />;
};
const meta = {
  title: "pstdio-workbench/Guides/Row target navigation",
  component: RowTargetNavigation,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RowTargetNavigation>;
export default meta;
export const ImmediatePage: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Ticket A", { exact: true }));
    await expect(await canvas.findByText("Ticket opened")).toBeVisible();
  },
};
