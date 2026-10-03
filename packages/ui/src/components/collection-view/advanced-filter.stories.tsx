import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Bar } from "./collection-view-bar-story";

const meta: Meta = { title: "Patterns/Collection View/Advanced Filter", parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

export const NormalAndAdvanced: Story = {
  render: () => (
    <Bar
      storageKey="storybook-normal-advanced"
      filter={{
        conjunction: "and",
        rules: [
          { attributeId: "archived", condition: "is", value: false },
          { attributeId: "priority", condition: "is-any-of", value: ["high", "medium"] },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const boolean = canvas.getByRole("group", { name: "Archived filter" });
    const subject = within(boolean).getByRole("button", { name: "Field" }).querySelector("span")!;
    const predicate = boolean.querySelector(":scope > p")!;
    expect(getComputedStyle(predicate).fontSize).toBe(getComputedStyle(subject).fontSize);
    expect(
      within(canvas.getByRole("group", { name: "Priority filter" })).getByRole("button", { name: "Condition" }),
    ).toHaveTextContent("is one of");
    await userEvent.click(canvas.getByRole("button", { name: "Filter", exact: true }));
    await waitFor(() =>
      expect(within(body.getByTestId("view-filter-popover")).getByText("And", { selector: "p" })).toBeVisible(),
    );
    await userEvent.click(body.getByRole("button", { name: "Advanced filter", exact: true }));
    const popover = await body.findByTestId("advanced-filter-popover");
    await userEvent.click(within(popover).getByRole("button", { name: "Add filter rule" }));
    await userEvent.click(within(popover).getByRole("button", { name: "Add filter rule" }));
    await userEvent.click(within(popover).getByRole("button", { name: "Conjunction" }));
    await userEvent.click(body.getByRole("menuitem", { name: "Or", exact: true }));
    await expect(within(popover).getByRole("button", { name: "Conjunction" })).toHaveTextContent("Or");
    await userEvent.click(within(popover).getAllByRole("button", { name: "Field", exact: true })[0]!);
    await userEvent.click(body.getByRole("menuitem", { name: "Status", exact: true }));
    await userEvent.click(within(popover).getByRole("button", { name: "Values" }));
    await userEvent.click(body.getByRole("menuitemcheckbox", { name: /Todo/ }));
    const valueIcon = body.getByRole("menuitemcheckbox", { name: /Todo/ }).querySelector(".chakra-icon")!;
    expect(valueIcon.getBoundingClientRect().width).toBe(12);
    await userEvent.keyboard("{Escape}");
  },
};

export const ExistingOrView: Story = {
  render: () => (
    <Bar
      storageKey="storybook-existing-or"
      filter={{
        conjunction: "or",
        rules: [
          { attributeId: "status", condition: "is-any-of", value: ["todo"] },
          { attributeId: "priority", condition: "is-any-of", value: ["high"] },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: "Edit advanced filter" })).toHaveTextContent(" or ");
    await userEvent.click(canvas.getByRole("button", { name: "Edit advanced filter" }));
    await waitFor(() =>
      expect(within(canvasElement.ownerDocument.body).getByTestId("advanced-filter-popover")).toBeVisible(),
    );
  },
};
