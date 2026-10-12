import { Box } from "@chakra-ui/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CollectionViewBar } from "./collection-view-bar";
import { Bar } from "./collection-view-bar-story";
import { storyFilter } from "./collection-view-story-fixtures";

const meta: Meta<typeof CollectionViewBar> = {
  title: "Patterns/Collection View/Filter Row",
  component: CollectionViewBar,
  parameters: { layout: "fullscreen" },
};

export default meta;
type Story = StoryObj;

export const ManyFilters: Story = {
  render: () => (
    <Box width="full" maxW="folder-picker-width">
      <Bar
        storageKey="storybook-many-filter-criteria"
        filter={storyFilter}
        editedSorts={[{ attributeId: "score", direction: "desc" }]}
      />
    </Box>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const row = await canvas.findByTestId("collection-view-criteria");
    const scrollArea = row.querySelector<HTMLElement>(':scope > [data-scope="scroll-area"][data-part="root"]');
    const viewport = scrollArea?.querySelector<HTMLElement>(':scope > [data-part="viewport"]') ?? null;
    expect(viewport).not.toBeNull();
    expect(viewport!.scrollWidth).toBeGreaterThan(viewport!.clientWidth);
    await userEvent.hover(viewport!);
    const scrollbar = scrollArea!.querySelector<HTMLElement>(
      ':scope > [data-part="scrollbar"][data-orientation="horizontal"]',
    );
    await waitFor(() => expect(scrollbar).toBeVisible());
    expect(getComputedStyle(scrollbar!).height).toBe("2px");
    expect(viewport!.scrollHeight).toBe(viewport!.clientHeight);

    const save = canvas.getByRole("button", { name: "Save view", exact: true });
    const reset = canvas.getByRole("button", { name: "Reset", exact: true });
    const saveBefore = save.getBoundingClientRect().left;
    const resetBefore = reset.getBoundingClientRect().left;
    viewport!.scrollLeft = viewport!.scrollWidth;
    await waitFor(() => expect(viewport!.scrollLeft).toBeGreaterThan(0));
    expect(save.getBoundingClientRect().left).toBe(saveBefore);
    expect(reset.getBoundingClientRect().left).toBe(resetBefore);
    await expect(canvas.getByRole("group", { name: "Updated filter" })).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Remove Updated filter", exact: true }));
    await expect(canvas.queryByRole("group", { name: "Updated filter" })).not.toBeInTheDocument();
  },
};
