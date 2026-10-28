import { Text } from "@chakra-ui/react";
import type { CanvasMeta, CanvasVariant } from "@pstdio/canvas";
import { renderBadgeListDisplay } from "@pstdio/ui/kanban-renderer";
import { useState } from "react";
import { createWorkbench } from "../../../core";
import { WorkbenchStory } from "../../../examples/workbench-story";
import { collectionBadgeTarget } from "../../../extensions/contributions/collection-badge-navigation";

const RowTargetNavigation = (props: { panel?: boolean }) => {
  const { panel } = props;
  const [workbench] = useState(() => {
    const w = createWorkbench();
    const ref = (id: string) => ({ kind: "page" as const, id, extensionId: "storybook" });
    w.views.registerView({
      id: "board",
      title: "Board",
      body: {
        kind: "kanban",
        attributes: panel
          ? [
              {
                id: "attention",
                label: "Needs attention",
                type: { kind: "string" },
                render: (value, row) =>
                  renderBadgeListDisplay(
                    {
                      id: "attention",
                      label: "Needs attention",
                      type: { kind: "string" },
                      display: { kind: "badge-list", itemsAttributeId: "items" },
                    },
                    value,
                    row,
                    undefined,
                    (id) => {
                      const target = collectionBadgeTarget(row, "items", id, "storybook", "project");
                      return target
                        ? () => {
                            void w.navigation.openTarget(target);
                          }
                        : undefined;
                    },
                  ),
              },
            ]
          : [],
        defaultSettings: { columnGrouping: "none", rowGrouping: "none", displayProperties: ["attention"] },
        executeQuery: async () => [
          {
            id: "a",
            title: "Ticket A",
            attributes: {
              items: [
                {
                  id: "attention",
                  label: "1",
                  tooltip: "1 item needs attention",
                  icon: "message-circle-warning",
                  action: {
                    kind: "panel",
                    panel: { kind: "page-slot", page: ref("tickets"), id: "attention" },
                    resource: { type: "ticket", id: "a" },
                  },
                },
              ],
            },
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
    w.views.registerView({
      id: "attention",
      title: "Needs attention",
      body: { kind: "react", render: () => <Text>Ticket attention</Text> },
    });
    w.modes.registerMode({ id: "project", activate() {} });
    for (const id of ["tickets", "ticket"])
      w.pages.registerPage({
        id,
        ref: ref(id),
        title: id,
        path: id,
        modeId: "project",
        slots:
          id === "tickets"
            ? [
                {
                  id: "attention",
                  region: "side",
                  item: {
                    kind: "binding",
                    binding: {
                      kinds: [{ kind: "resource-kind", id: "ticket" }],
                      view: { kind: "view", id: "attention" },
                      cardinality: "one",
                    },
                  },
                },
              ]
            : [],
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
} satisfies CanvasMeta<typeof RowTargetNavigation>;
export default meta;
export const ImmediatePage: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-guides-row-target-navigation--immediate-page",
};
export const BadgeOpensSidePanel: CanvasVariant<typeof meta> = {
  id: "pstdio-workbench-guides-row-target-navigation--badge-opens-side-panel",
  args: { panel: true },
};
