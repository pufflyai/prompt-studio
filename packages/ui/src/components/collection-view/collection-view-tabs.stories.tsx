import { Box, HStack, Text } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CollectionViewTabs } from "./collection-view-tabs";
import { EMPTY_VIEW_FILTER } from "./collection-view-types";

const views = Array.from({ length: 18 }, (_, index) => ({
  id: String(index),
  title: `Team view ${index + 1}`,
  settings: {},
  filter: EMPTY_VIEW_FILTER,
  sorts: [],
  builtIn: false,
}));

const CrowdedTabs = () => {
  const [activeViewId, setActiveViewId] = useState("0");
  return (
    <Box width="full" maxW="24rem">
      <HStack gap="2xs">
        <CollectionViewTabs
          views={views}
          activeViewId={activeViewId}
          dirty={false}
          busy={false}
          state={views[0]!}
          onActivate={(view) => setActiveViewId(view.id)}
          run={(action) => void action()}
          createView={async () => undefined}
        />
      </HStack>
      <Text data-testid="active-view">{activeViewId}</Text>
    </Box>
  );
};

const meta: Meta = {
  title: "Patterns/Collection View/View Tabs",
};
export default meta;
type Story = StoryObj;

const ReorderableTabs = () => {
  const [savedViews, setSavedViews] = useState(views.slice(0, 3));
  const [activeViewId, setActiveViewId] = useState("0");
  const source = {
    views: savedViews,
    defaultViewId: "0",
    onCreateView: async () => savedViews[0]!,
    onUpdateView: async () => undefined,
    onDeleteView: async () => undefined,
    onSetDefaultView: async () => undefined,
    onReorderViews: async (ids: string[]) => setSavedViews(ids.map((id) => savedViews.find((view) => view.id === id)!)),
  };
  return (
    <HStack>
      <CollectionViewTabs
        views={savedViews}
        viewsSource={source}
        activeViewId={activeViewId}
        dirty
        busy={false}
        state={savedViews[0]!}
        onActivate={(view) => setActiveViewId(view.id)}
        run={(action) => void action()}
        createView={async () => undefined}
      />
    </HStack>
  );
};

export const ReorderViews: Story = {
  render: () => <ReorderableTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const selected = canvas.getByRole("tab", { name: /^Team view 1/ });
    selected.focus();
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Team view 2",
      "Team view 1",
      "Team view 3",
    ]);
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await expect(selected).toHaveFocus();
    await expect(canvas.getByLabelText("Unsaved view changes")).toBeVisible();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await expect(canvas.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Team view 1",
      "Team view 2",
      "Team view 3",
    ]);
    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() =>
      expect(canvas.getByRole("tab", { name: /^Team view 2/ })).toHaveAttribute("aria-selected", "true"),
    );
  },
};

export const ManyViews: Story = {
  render: () => <CrowdedTabs />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvasElement.querySelector<HTMLElement>('[data-part="viewport"]');
    expect(viewport).not.toBeNull();
    expect(viewport!.scrollWidth).toBeGreaterThan(viewport!.clientWidth);
    expect(getComputedStyle(canvasElement.querySelector('[data-part="scrollbar"]')!).height).toBe("2px");
    const first = canvas.getByRole("tab", { name: "Team view 1", exact: true });
    first.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(canvas.getByTestId("active-view")).toHaveTextContent("17"));
    const last = canvas.getByRole("tab", { name: "Team view 18", exact: true }).getBoundingClientRect();
    expect(last.right).toBeLessThanOrEqual(viewport!.getBoundingClientRect().right + 1);
    await expect(canvas.getByRole("button", { name: "Add view" })).toBeVisible();
  },
};
