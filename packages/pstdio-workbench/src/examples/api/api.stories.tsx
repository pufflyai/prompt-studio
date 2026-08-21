import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { apiSources } from "./api-sources";
import { CompositionQueryExample, compositionPanelIds } from "./composition-query-example";
import { ExtensionPlacementExample } from "./extension-placement-example";
import { DuplicateTabsExample, ResourceTabsExample, SingletonPanelExample } from "./panel-tabs-examples";

const meta = {
  title: "pstdio-workbench/API",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const sourceParameters = (code: string) => ({
  docs: {
    source: {
      code,
      language: "tsx",
      type: "code",
    },
  },
});

export const CompositionPanelQuery: Story = {
  name: "Composition panel query",
  parameters: sourceParameters(apiSources.compositionQuery),
  render: () => <CompositionQueryExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("main-open")).toHaveTextContent(compositionPanelIds.overview);
    await expect(canvas.getByTestId("main-addable")).toHaveTextContent(compositionPanelIds.artifacts);
    await expect(canvas.getByTestId("side-closable")).toHaveTextContent(compositionPanelIds.inspector);
  },
};

export const SingletonPanel: Story = {
  name: "Singleton panel",
  parameters: sourceParameters(apiSources.singletonPanel),
  render: () => <SingletonPanelExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const firstInstanceId = canvas.getByTestId("singleton-returned-id").textContent;

    await userEvent.click(canvas.getByRole("button", { name: "Open singleton again" }));

    await expect(canvas.getByTestId("singleton-count")).toHaveTextContent("1");
    await expect(canvas.getByTestId("singleton-returned-id")).toHaveTextContent(firstInstanceId ?? "");
    await expect(canvas.queryByRole("button", { name: "Add panel" })).not.toBeInTheDocument();
  },
};

export const ResourceTabs: Story = {
  name: "Multiple tabs by resource",
  parameters: sourceParameters(apiSources.resourceTabs),
  render: () => <ResourceTabsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("resource-count")).toHaveTextContent("2");
    await userEvent.click(canvas.getByRole("button", { name: "Reopen Alpha" }));
    await expect(canvas.getByTestId("resource-count")).toHaveTextContent("2");
    await expect(canvas.getByRole("tab", { name: "Alpha.md" })).toHaveAttribute("aria-selected", "true");
  },
};

export const DuplicateTabs: Story = {
  name: "Multiple tabs without reuse",
  parameters: sourceParameters(apiSources.duplicateTabs),
  render: () => <DuplicateTabsExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByTestId("duplicate-count")).toHaveTextContent("2");
    await userEvent.click(canvas.getByRole("button", { name: "New scratch tab" }));
    await expect(canvas.getByTestId("duplicate-count")).toHaveTextContent("3");
    await expect(canvas.getByRole("tab", { name: "Scratch 3" })).toHaveAttribute("aria-selected", "true");
  },
};

export const ExtensionPanelPlacement: Story = {
  name: "Extension panel placement",
  parameters: sourceParameters(apiSources.extensionPlacement),
  render: () => <ExtensionPlacementExample />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("placement-region")).toHaveTextContent("main");
    await userEvent.click(canvas.getByRole("button", { name: "Move to sidenav" }));
    await expect(canvas.getByTestId("placement-region")).toHaveTextContent("sidenav");
  },
};
