import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { CollectionViewBar } from "./collection-view-bar";
import { Bar } from "./collection-view-bar-story";
import { storyFilter } from "./collection-view-story-fixtures";

const meta: Meta<typeof CollectionViewBar> = {
  title: "Patterns/Collection View/Collection View Bar",
  component: CollectionViewBar,
  parameters: { layout: "fullscreen" },
};

export default meta;

type Story = StoryObj;

export const NoRules: Story = {
  render: () => <Bar storageKey="storybook-collection-view-bar-no-rules" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    const popover = await body.findByTestId("filter-menu-popover");
    const expectAnchored = async () => {
      await waitFor(() => {
        const trigger = canvas.getByRole("button", { name: "Filter", exact: true }).getBoundingClientRect();
        const bounds = popover.getBoundingClientRect();
        expect(bounds.top).toBeGreaterThanOrEqual(trigger.bottom);
        expect(bounds.left).toBeGreaterThan(0);
      });
    };
    await expectAnchored();
    await userEvent.click(within(popover).getByRole("checkbox", { name: "Todo", exact: true }));
    await expect(canvas.getByRole("group", { name: "Status filter" })).toBeVisible();
    await expectAnchored();
    await userEvent.click(within(popover).getByRole("button", { name: "Clear all filters", exact: true }));
    await expect(within(popover).getByRole("checkbox", { name: "Todo", exact: true })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expectAnchored();
  },
};

/** Saved rules always show in the criteria row, so nothing that hides rows is invisible. */
export const RulesSaved: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-bar-saved"
      filter={storyFilter}
      sorts={[{ attributeId: "priority", direction: "asc" }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filter = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(filter.getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    await expect(filter.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
    await expect(canvas.queryByRole("button", { name: "Save view" })).not.toBeInTheDocument();
  },
};

/** Both normal filter entry points open the same picker and reflect existing exclusions. */
export const SharedPropertyPicker: Story = {
  render: () => <Bar storageKey="storybook-shared-property-picker" filter={storyFilter} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Status filter" }));
    expect(getComputedStyle(pill.getByRole("button", { name: "Condition" })).color).not.toBe(
      getComputedStyle(pill.getByRole("button", { name: "Field" })).color,
    );
    for (const name of ["Filter", "Add filter"]) {
      await userEvent.click(canvas.getByRole("button", { name, exact: true }));
      const picker = await body.findByTestId("filter-menu");
      await waitFor(() => expect(within(picker).getByRole("textbox", { name: "Filter properties" })).toBeVisible());
      await expect(within(picker).getByRole("checkbox", { name: "Done", exact: true })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      await userEvent.keyboard("{Escape}");
    }
  },
};

/** Clearing the lower picker closes it before its last criterion removes the anchor. */
export const ClearLastFilterFromPicker: Story = {
  render: () => <Bar storageKey="storybook-clear-lower-picker" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    await userEvent.click(body.getByRole("checkbox", { name: "Todo", exact: true }));
    await userEvent.keyboard("{Escape}");
    await userEvent.click(canvas.getByRole("button", { name: "Add filter", exact: true }));
    const popover = await body.findByTestId("filter-menu-popover");
    await waitFor(() => expect(popover).toBeVisible());
    const positions: DOMRect[] = [];
    let frame = 0;
    const observe = () => {
      if (popover.isConnected && getComputedStyle(popover.parentElement!).visibility !== "hidden") {
        positions.push(popover.getBoundingClientRect());
      }
      frame = requestAnimationFrame(observe);
    };
    frame = requestAnimationFrame(observe);
    await userEvent.click(within(popover).getByRole("button", { name: "Clear all filters" }));
    await waitFor(() => expect(popover).not.toBeVisible());
    cancelAnimationFrame(frame);
    for (const position of positions) {
      expect(position.left).toBeGreaterThan(0);
      expect(position.top).toBeGreaterThan(0);
    }
  },
};

/** An edit marks the tab and offers Reset and Save until the view is saved. */
export const UnsavedChanges: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-bar-unsaved"
      filter={storyFilter}
      editedSorts={[{ attributeId: "score", direction: "desc" }]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText("Unsaved view changes")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Save as new view" })).toBeVisible();
  },
};

/** Search is screen state: it never marks the view as changed. */
export const SearchOpen: Story = {
  render: () => <Bar storageKey="storybook-collection-view-bar-search" filter={storyFilter} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Search this view" }));
    await userEvent.type(canvas.getByRole("textbox", { name: "Search this view" }), "filter");
    await expect(canvas.getByText("4 of 10")).toBeVisible();
    await expect(canvas.queryByLabelText("Unsaved view changes")).not.toBeInTheDocument();
  },
};

/** Booleans name a predicate; the operator selects its truth value. */
export const BooleanPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-collection-view-boolean"
      filter={{ conjunction: "and", rules: [{ attributeId: "archived", condition: "is", value: false }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pill = canvas.getByRole("group", { name: "Archived filter" });
    await expect(within(pill).getByRole("button", { name: "Field" })).toHaveTextContent("Ticket");
    await expect(within(pill).getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(within(pill).getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is", exact: true }));
    await expect(within(pill).getByRole("button", { name: "Condition" })).toHaveTextContent("is");
  },
};

/** Both sort directions remain visible inside Display, which owns one ordering. */
export const NestedSortChoices: Story = {
  render: () => <Bar storageKey="storybook-sort-choices" sorts={[{ attributeId: "updated", direction: "desc" }]} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "Display settings" }));
    await userEvent.click(await body.findByRole("button", { name: "Sort direction" }));
    const menu = await body.findByRole("menu");
    const newest = within(menu).getByRole("menuitem", { name: "Newest first" });
    const oldest = within(menu).getByRole("menuitem", { name: "Oldest first" });
    await expect(newest.querySelector(".lucide-check")).toBeInTheDocument();
    await waitFor(() => {
      const bounds = menu.getBoundingClientRect();
      for (const option of [newest, oldest]) {
        const row = option.getBoundingClientRect();
        expect(row.top).toBeGreaterThanOrEqual(bounds.top);
        expect(row.bottom).toBeLessThanOrEqual(bounds.bottom);
      }
    });
    await userEvent.click(oldest);
    await userEvent.click(body.getByRole("button", { name: "Sort direction" }));
    const reopened = await body.findByRole("menu");
    await expect(
      within(reopened).getByRole("menuitem", { name: "Oldest first" }).querySelector(".lucide-check"),
    ).toBeInTheDocument();
    await userEvent.click(within(reopened).getByRole("menuitem", { name: "Newest first" }));
    await expect(body.getByRole("button", { name: "Sort direction" })).toHaveTextContent("Newest first");
    await userEvent.click(body.getByRole("button", { name: "Ordering" }));
    await userEvent.click(body.getByRole("menuitem", { name: "None", exact: true }));
    await expect(body.getByRole("button", { name: "Ordering" })).toHaveTextContent("None");
    await expect(body.queryByRole("button", { name: "Sort direction" })).not.toBeInTheDocument();
  },
};

/** Property, condition, and value are independent controls; values toggle without closing. */
export const IndependentFilterChoices: Story = {
  tags: ["!manifest"],
  render: () => (
    <Bar
      storageKey="storybook-independent-filter-choices"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-any-of", value: ["todo"] }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(pill.getByRole("button", { name: "Field" }).querySelector("svg")).toBeNull();
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await expect(body.getAllByRole("menuitem")).toHaveLength(2);
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    const todo = body.getByRole("menuitemcheckbox", { name: /Todo/ });
    const done = body.getByRole("menuitemcheckbox", { name: /Done/ });
    const label = todo.querySelector("p")!.getBoundingClientRect();
    const checkbox = todo.querySelector("[data-part=control]")!.getBoundingClientRect();
    expect(checkbox.left).toBeGreaterThan(label.right);
    await expect(todo).toHaveAttribute("aria-checked", "true");
    await expect(todo.querySelector(".lucide-circle")).toBeInTheDocument();
    await userEvent.click(done);
    await expect(done).toHaveAttribute("aria-checked", "true");
    await expect(todo).toBeVisible();
    await userEvent.click(todo);
    await expect(todo).toHaveAttribute("aria-checked", "false");
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(pill.getByRole("button", { name: "Field" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Priority", exact: true }));
    await expect(canvas.getByRole("group", { name: "Priority filter" })).toBeVisible();
  },
};

/** Imported empty predicates keep their meaning until a real value is chosen. */
export const EmptyOptionPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-empty-option-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "status", condition: "is-empty" }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Status filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Empty");
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is not", exact: true }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Empty");
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: /Done/ }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("Done");
    await expect(pill.getByRole("button", { name: "Condition" })).toHaveTextContent("is not");
    await userEvent.keyboard("{Escape}");
  },
};

/** Incoming all-value rules stay explicit and retain their condition while values change. */
export const AllValuesPredicate: Story = {
  render: () => (
    <Bar
      storageKey="storybook-all-values-predicate"
      filter={{ conjunction: "and", rules: [{ attributeId: "labels", condition: "has-all-of", value: ["bug"] }] }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const pill = within(canvas.getByRole("group", { name: "Labels filter" }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug");
    await userEvent.click(pill.getByRole("button", { name: "Condition" }));
    await userEvent.click(body.getByRole("menuitem", { name: "is", exact: true }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug");
    await userEvent.click(pill.getByRole("button", { name: "Values" }));
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: /Regression/ }));
    await expect(pill.getByRole("button", { name: "Values" })).toHaveTextContent("all of Bug, Regression");
    await userEvent.keyboard("{Escape}");
  },
};
