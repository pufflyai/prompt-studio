import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import { createWorkbench } from "../../core";
import { usePageParams } from "./use-page-params";

const IndependentViewerQuery = () => {
  const [{ workbench, placement }] = useState(() => {
    const workbench = createWorkbench();
    const page = { kind: "page", extensionId: "example", id: "records" } as const;
    workbench.modes.registerMode({ id: "project", activate() {} });
    workbench.views.registerView({ id: "reader", title: "Reader", body: { kind: "react", render: () => null } });
    workbench.pages.registerPage({
      id: "records",
      ref: page,
      path: "records",
      modeId: "project",
      params: { filter: { type: "string", default: "all" }, limit: { type: "number", default: 10 } },
      main: { kind: "panels" },
      slots: [],
    });
    const panel = { kind: "placement", extensionId: "example", id: "reader" } as const;
    workbench.modePlacements.registerPlacement({
      id: "reader",
      ref: panel,
      modeId: "project",
      region: "side",
      item: {
        kind: "binding",
        binding: {
          kinds: [{ kind: "resource-kind", id: "record" }],
          cardinality: "many",
          view: { kind: "view", id: "reader" },
        },
      },
    });
    workbench.pageLocations.setProject("project");
    workbench.pageLocations.navigate({ kind: "page", page, params: { filter: "main" } });
    workbench.modePlacements.openPlacement({
      panel,
      resource: { type: "record", id: "one" },
      open: "pin",
      location: { pageContext: { page, params: { filter: "mine" } } },
    });
    return { workbench, placement: workbench.layout.getActivePanel("side")! };
  });
  const params = usePageParams(workbench, placement);
  return <output aria-label="Native viewer query">{JSON.stringify(params)}</output>;
};
const meta = {
  title: "pstdio-workbench/Guides/Native viewer query",
  component: IndependentViewerQuery,
  tags: ["view-page-params"],
} satisfies Meta<typeof IndependentViewerQuery>;
export default meta;
export const IndependentPageContext: StoryObj<typeof meta> = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByLabelText("Native viewer query")).toHaveTextContent(
      '{"filter":"mine","limit":10}',
    );
  },
};
